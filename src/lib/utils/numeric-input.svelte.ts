import { parseCommittableNumber, settleNumber, type NumericBounds } from './numeric-input';

export interface NumericFieldOptions<T extends number | null> extends NumericBounds {
	/** The committed value the field shows when it is not being edited. */
	value: () => T;
	/** Write a settled value back. Only ever called with an in-bounds value. */
	commit: (next: T) => void;
	/**
	 * What an emptied field settles to on blur.
	 *
	 * Pass `null` to make the field clearable — empty then counts as a value
	 * rather than a half-typed state and commits immediately. Omit it and an
	 * emptied field falls back to the value committed before the edit.
	 */
	emptyValue?: T;
}

export interface NumericField {
	/** Bind to the input's `value=`. */
	readonly value: string;
	oninput: (event: Event & { currentTarget: HTMLInputElement }) => void;
	onblur: () => void;
	/**
	 * Drop an in-progress edit and show the committed value again. Call it where
	 * the field is re-seeded behind the user's back — a dialog reopening, say,
	 * which can unmount a focused input without ever firing `blur`.
	 */
	reset: () => void;
}

/**
 * Wire up a numeric `<input>` that stays editable while the user types.
 *
 * The returned `value` is a free-text buffer for as long as the field has focus:
 * `oninput` commits only values that are already valid and leaves everything else
 * (empty, `0` under a `min` of 1, a half-typed decimal) alone, so no keystroke is
 * ever overwritten under the caret. `onblur` clamps and normalizes what is left.
 *
 * Clamping on blur rather than per keystroke is also the better WCAG 3.3.1
 * behavior: a value silently rewritten mid-typing is not an error the user can
 * perceive or correct.
 *
 * ```svelte
 * const window = numericField({
 *   value: () => generationWindowWeeks,
 *   commit: (n) => (generationWindowWeeks = n),
 *   min: 1,
 *   max: 52
 * });
 *
 * <Input type="number" min={1} max={52}
 *        value={window.value} oninput={window.oninput} onblur={window.onblur} />
 * ```
 */
export function numericField<T extends number | null = number>(
	options: NumericFieldOptions<T>
): NumericField {
	// `null` means "not being edited": the field renders the committed value, so a
	// change from elsewhere (a parent prop, a dialog reopening) shows through on
	// its own — no `$effect` re-sync racing the user's keystrokes.
	let draft = $state<string | null>(null);

	const clearable = options.emptyValue === null;

	return {
		get value(): string {
			if (draft !== null) return draft;
			const current = options.value();
			return current === null || current === undefined ? '' : String(current);
		},

		oninput(event): void {
			const raw = event.currentTarget.value;
			draft = raw;

			const parsed = parseCommittableNumber(raw, options);
			if (parsed !== null) {
				options.commit(parsed as T);
				return;
			}
			// A clearable field commits the clear straight away: empty is a value
			// there, and Enter-submitting a form fires no blur to settle it. But a
			// number input also reports an empty `value` for text it cannot parse —
			// a lone "-" on the way to "-1" — and that is a half-typed state, not a
			// clear. `badInput` is what tells the two apart.
			if (clearable && raw.trim() === '' && !event.currentTarget.validity?.badInput) {
				options.commit(null as T);
			}
			// Anything else commits nothing — the last valid value stands until blur.
		},

		onblur(): void {
			if (draft === null) return; // never edited; nothing to settle
			const raw = draft;
			draft = null;

			const current = options.value();
			const fallback =
				options.emptyValue !== undefined ? options.emptyValue : (current ?? options.min ?? 0);
			const settled = settleNumber(raw, {
				min: options.min,
				max: options.max,
				decimal: options.decimal,
				fallback
			});

			// Releasing the buffer already re-renders the normalized display ("05" is
			// now "5"), so a settle that lands on the value already committed has
			// nothing to write back — and writing it anyway would open an undo point
			// or mark a form dirty for an edit that changed nothing.
			if (settled !== current) {
				options.commit(settled as T);
			}
		},

		reset(): void {
			draft = null;
		}
	};
}
