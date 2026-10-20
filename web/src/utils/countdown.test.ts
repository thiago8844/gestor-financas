import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Countdown } from "./countdown";

describe("Countdown", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("dispara ao esgotar a duração", () => {
    const fn = vi.fn();
    new Countdown(5000, fn).start();

    vi.advanceTimersByTime(4999);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retoma do tempo restante, sem reiniciar", () => {
    const fn = vi.fn();
    const c = new Countdown(5000, fn);
    c.start();

    vi.advanceTimersByTime(3000);
    c.pause();
    expect(c.tempoRestante).toBe(2000);

    vi.advanceTimersByTime(60_000); // pausado: nada acontece
    expect(fn).not.toHaveBeenCalled();

    c.resume();
    vi.advanceTimersByTime(1999);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("dispose cancela sem disparar e não deixa timer pendente", () => {
    const fn = vi.fn();
    const c = new Countdown(5000, fn);
    c.start();
    c.dispose();

    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(10_000);
    expect(fn).not.toHaveBeenCalled();
    c.start(); // depois de descartado não volta a rodar
    expect(vi.getTimerCount()).toBe(0);
  });

  it("pausar duas vezes ou retomar sem pausar é inofensivo", () => {
    const fn = vi.fn();
    const c = new Countdown(1000, fn);
    c.start();
    c.start();
    expect(vi.getTimerCount()).toBe(1);
    c.pause();
    c.pause();
    c.resume();
    vi.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
