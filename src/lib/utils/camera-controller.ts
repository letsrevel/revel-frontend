/**
 * A tiny reconciling state machine for a camera whose start/stop are slow,
 * fallible async calls. Callers only record what they WANT (`setWanted`); one
 * worker loop drives the driver towards that, so exactly one driver call is ever
 * in flight and intent changes made during a call are picked up afterwards.
 * No DOM, no Svelte.
 */
export type CameraPhase = 'off' | 'starting' | 'on' | 'stopping';

export interface CameraDriver {
	start(): Promise<void>;
	stop(): Promise<void>;
}

export interface CameraHooks {
	onPhase(phase: CameraPhase): void;
	onStartError(error: unknown): void;
	onStopError?(error: unknown): void;
}

export class CameraController {
	private wanted = false;
	private actual: 'off' | 'on' = 'off';
	private destroyed = false;
	private worker: Promise<void> | null = null;
	private phase: CameraPhase = 'off';

	constructor(
		private readonly driver: CameraDriver,
		private readonly hooks: CameraHooks
	) {}

	/** Record the intent, then reconcile. Ignored once destroyed. */
	setWanted(wanted: boolean): void {
		if (this.destroyed) return;
		this.wanted = wanted;
		this.reconcile();
	}

	/** Resolves when no driver operation is in flight. */
	async idle(): Promise<void> {
		while (this.worker) await this.worker;
	}

	/** Turn the camera off for good: it never starts again. */
	async destroy(): Promise<void> {
		this.wanted = false;
		this.destroyed = true;
		this.reconcile();
		await this.idle();
	}

	private setPhase(phase: CameraPhase): void {
		if (this.phase === phase) return;
		this.phase = phase;
		this.hooks.onPhase(phase);
	}

	private needsWork(): boolean {
		return this.wanted !== (this.actual === 'on');
	}

	private reconcile(): void {
		if (this.worker || !this.needsWork()) return;
		this.worker = this.run().finally(() => {
			this.worker = null;
		});
	}

	private async run(): Promise<void> {
		while (this.needsWork()) {
			if (this.wanted) {
				this.setPhase('starting');
				try {
					await this.driver.start();
					this.actual = 'on';
				} catch (error) {
					this.wanted = false;
					this.actual = 'off';
					this.hooks.onStartError(error);
				}
			} else {
				this.setPhase('stopping');
				try {
					await this.driver.stop();
					this.actual = 'off';
				} catch (error) {
					// The camera may still be running: keep `actual` as it is and leave the
					// loop rather than retrying hot. The next `setWanted` retries the stop.
					this.hooks.onStopError?.(error);
					break;
				}
			}
		}
		this.setPhase(this.actual === 'on' ? 'on' : 'off');
	}
}
