/**
 * Floor-plan state for the sector-block arranger (#680, runes-in-a-class).
 *
 * Owns the editable floor list (create/rename/reorder/delete), the per-block
 * EXPLICIT floor assignments and the active-floor switch, mirroring the
 * DesignerController's transforms/baseline pattern so `buildSavePlan` writes
 * only what changed. Resolution follows the shared convention
 * (venue-floors.ts): a block with no explicit assignment belongs to the FIRST
 * floor (lowest order); no floors at all means the single flattened plane.
 *
 * Deleting a floor that still has sectors (explicitly OR implicitly — an
 * implicit block would silently jump to the next first floor otherwise) is
 * refused deterministically; callers surface the message.
 */
import { SvelteMap } from 'svelte/reactivity';
import { floorsEqual, newFloorId, type VenueFloor } from '../venue-floors';
import type { DesignerModel } from './designer-model';

const cloneFloors = (floors: readonly VenueFloor[]): VenueFloor[] =>
	floors.map((floor) => ({ ...floor }));

export class DesignerFloorState {
	floors = $state<VenueFloor[]>([]);
	/** $state: `dirty` must recompute when a save commits the baseline. */
	private baselineFloors = $state<VenueFloor[]>([]);
	/** Explicit assignments only (null = implicit first floor). */
	readonly floorIds: SvelteMap<string, string | null>;
	private readonly baselineFloorIds: SvelteMap<string, string | null>;
	activeFloorId = $state<string | null>(null);

	constructor(private readonly model: DesignerModel) {
		this.floors = cloneFloors(model.floors);
		this.baselineFloors = cloneFloors(model.floors);
		this.floorIds = new SvelteMap(model.blocks.map((b) => [b.id, b.floorId]));
		this.baselineFloorIds = new SvelteMap(model.blocks.map((b) => [b.id, b.floorId]));
		this.activeFloorId = model.floors[0]?.id ?? null;
	}

	readonly hasFloors = $derived(this.floors.length > 0);
	readonly firstFloorId = $derived(this.floors[0]?.id ?? null);
	readonly activeFloor = $derived(
		this.floors.find((floor) => floor.id === this.activeFloorId) ?? null
	);
	/**
	 * The stage has no floor field; by convention it belongs to the FIRST
	 * (ground) floor — the safe default for the venue-level stage marker.
	 */
	readonly stageVisible = $derived(!this.hasFloors || this.activeFloorId === this.firstFloorId);

	readonly dirty = $derived.by(() => {
		// Read EVERY operand (no short-circuit early return): a `return true`
		// before the map reads would leave them untracked, freezing `dirty` on
		// true after a save commits the baselines (same class of bug as the
		// TanStack tracked-props `||` freeze).
		const planChanged = !floorsEqual(this.floors, this.baselineFloors);
		const assignmentsChanged = this.model.blocks.some(
			(block) =>
				(this.floorIds.get(block.id) ?? null) !== (this.baselineFloorIds.get(block.id) ?? null)
		);
		return planChanged || assignmentsChanged;
	});

	/** The floor a block effectively lives on (explicit, else first floor). */
	effectiveFloorOf(blockId: string): string | null {
		if (!this.hasFloors) return null;
		const explicit = this.floorIds.get(blockId) ?? null;
		return explicit && this.floors.some((floor) => floor.id === explicit)
			? explicit
			: this.firstFloorId;
	}

	/** Whether a block belongs on the current canvas (all, when floor-less). */
	isVisible(blockId: string): boolean {
		return !this.hasFloors || this.effectiveFloorOf(blockId) === this.activeFloorId;
	}

	/** Names of the sectors effectively on a floor (delete guard + messages). */
	sectorNamesOn(floorId: string): string[] {
		return this.model.blocks
			.filter((block) => this.effectiveFloorOf(block.id) === floorId)
			.map((block) => block.name);
	}

	/** Create a floor after the current last one and make it active. */
	addFloor(name: string): VenueFloor {
		const last = this.floors[this.floors.length - 1];
		const floor: VenueFloor = { id: newFloorId(), name, order: last ? last.order + 1 : 0 };
		this.floors = [...this.floors, floor];
		this.activeFloorId = floor.id;
		return floor;
	}

	renameFloor(id: string, name: string): void {
		const trimmed = name.trim();
		if (!trimmed) return;
		this.floors = this.floors.map((floor) =>
			floor.id === id ? { ...floor, name: trimmed } : floor
		);
	}

	/** Swap a floor with its neighbor (delta ±1) and normalize orders to 0..n-1. */
	moveFloor(id: string, delta: -1 | 1): void {
		const index = this.floors.findIndex((floor) => floor.id === id);
		const target = index + delta;
		if (index === -1 || target < 0 || target >= this.floors.length) return;
		const next = [...this.floors];
		[next[index], next[target]] = [next[target], next[index]];
		this.floors = next.map((floor, position) => ({ ...floor, order: position }));
	}

	/** Refused (false) while the floor still has sectors, even implicit ones. */
	deleteFloor(id: string): boolean {
		if (this.sectorNamesOn(id).length > 0) return false;
		this.floors = this.floors.filter((floor) => floor.id !== id);
		if (this.activeFloorId === id) this.activeFloorId = this.firstFloorId;
		return true;
	}

	/** Explicitly assign a block to a floor (persisted on the next save). */
	moveBlockToFloor(blockId: string, floorId: string): void {
		if (!this.floors.some((floor) => floor.id === floorId)) return;
		this.floorIds.set(blockId, floorId);
	}

	/** buildSavePlan inputs for the floor plan + assignments. */
	get saveInput() {
		return {
			floors: this.floors,
			baselineFloors: this.baselineFloors,
			floorIds: this.floorIds as ReadonlyMap<string, string | null>,
			baselineFloorIds: this.baselineFloorIds as ReadonlyMap<string, string | null>
		};
	}

	/** After a successful save: the current state becomes the baseline. */
	commitBaseline(): void {
		this.baselineFloors = cloneFloors(this.floors);
		for (const [id, floorId] of this.floorIds) this.baselineFloorIds.set(id, floorId);
	}
}
