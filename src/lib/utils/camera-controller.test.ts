import { describe, it, expect, vi } from 'vitest';
import { CameraController, type CameraPhase } from './camera-controller';

interface Deferred {
	resolve: () => void;
	reject: (e: unknown) => void;
}

function setup() {
	const startCalls: Deferred[] = [];
	const stopCalls: Deferred[] = [];
	const defer = (into: Deferred[]) =>
		new Promise<void>((resolve, reject) => {
			into.push({ resolve, reject });
		});
	const driver = {
		start: vi.fn(() => defer(startCalls)),
		stop: vi.fn(() => defer(stopCalls))
	};
	const phases: CameraPhase[] = [];
	const onStartError = vi.fn();
	const onStopError = vi.fn();
	const controller = new CameraController(driver, {
		onPhase: (p) => phases.push(p),
		onStartError,
		onStopError
	});
	return { controller, driver, startCalls, stopCalls, phases, onStartError, onStopError };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('CameraController', () => {
	it('stop during a pending start stops once the start resolves', async () => {
		const t = setup();
		t.controller.setWanted(true);
		t.controller.setWanted(false);
		expect(t.driver.stop).not.toHaveBeenCalled();
		t.startCalls[0].resolve();
		await tick();
		expect(t.driver.stop).toHaveBeenCalledTimes(1);
		t.stopCalls[0].resolve();
		await t.controller.idle();
		expect(t.phases.at(-1)).toBe('off');
		expect(t.driver.start).toHaveBeenCalledTimes(1);
	});

	it('start during a pending stop restarts exactly once', async () => {
		const t = setup();
		t.controller.setWanted(true);
		t.startCalls[0].resolve();
		await t.controller.idle();
		expect(t.phases.at(-1)).toBe('on');

		t.controller.setWanted(false);
		t.controller.setWanted(true);
		expect(t.driver.start).toHaveBeenCalledTimes(1);
		t.stopCalls[0].resolve();
		await tick();
		expect(t.driver.start).toHaveBeenCalledTimes(2);
		t.startCalls[1].resolve();
		await t.controller.idle();
		expect(t.phases.at(-1)).toBe('on');
		expect(t.driver.stop).toHaveBeenCalledTimes(1);
	});

	it('repeated setWanted(false) calls stop once', async () => {
		const t = setup();
		t.controller.setWanted(true);
		t.startCalls[0].resolve();
		await t.controller.idle();
		t.controller.setWanted(false);
		t.controller.setWanted(false);
		t.controller.setWanted(false);
		t.stopCalls[0].resolve();
		await t.controller.idle();
		t.controller.setWanted(false);
		await t.controller.idle();
		expect(t.driver.stop).toHaveBeenCalledTimes(1);
	});

	it('destroy during a pending start ends off and never starts again', async () => {
		const t = setup();
		t.controller.setWanted(true);
		const destroyed = t.controller.destroy();
		t.startCalls[0].resolve();
		await tick();
		t.stopCalls[0].resolve();
		await destroyed;
		t.controller.setWanted(true);
		await t.controller.idle();
		expect(t.phases.at(-1)).toBe('off');
		expect(t.driver.start).toHaveBeenCalledTimes(1);
		expect(t.driver.stop).toHaveBeenCalledTimes(1);
	});

	it('destroy during a pending stop with a queued start does not start', async () => {
		const t = setup();
		t.controller.setWanted(true);
		t.startCalls[0].resolve();
		await t.controller.idle();
		t.controller.setWanted(false);
		t.controller.setWanted(true); // queued restart
		const destroyed = t.controller.destroy();
		t.stopCalls[0].resolve();
		await destroyed;
		expect(t.driver.start).toHaveBeenCalledTimes(1);
		expect(t.phases.at(-1)).toBe('off');
	});

	it('a stop that throws still ends off, and a later start works', async () => {
		const t = setup();
		t.controller.setWanted(true);
		t.startCalls[0].resolve();
		await t.controller.idle();
		t.controller.setWanted(false);
		t.stopCalls[0].reject(new Error('stop failed'));
		await t.controller.idle();
		expect(t.onStopError).toHaveBeenCalledTimes(1);
		expect(t.phases.at(-1)).toBe('off');

		t.controller.setWanted(true);
		expect(t.driver.start).toHaveBeenCalledTimes(2);
		t.startCalls[1].resolve();
		await t.controller.idle();
		expect(t.phases.at(-1)).toBe('on');
	});

	it('a failed start reports the error, resets the intent and ends off', async () => {
		const t = setup();
		const boom = new Error('denied');
		t.controller.setWanted(true);
		t.startCalls[0].reject(boom);
		await t.controller.idle();
		expect(t.onStartError).toHaveBeenCalledWith(boom);
		expect(t.phases.at(-1)).toBe('off');
		expect(t.driver.stop).not.toHaveBeenCalled();
		expect(t.driver.start).toHaveBeenCalledTimes(1);
	});
});
