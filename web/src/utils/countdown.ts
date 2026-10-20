/**
 * Contagem regressiva com pausa/retomada: ao pausar guarda o tempo restante e, ao retomar,
 * continua dele (não reinicia). Sem dependência de React para ser testável com timers falsos.
 */
export class Countdown {
  private restante: number;
  private inicio = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private encerrado = false;

  private readonly aoEsgotar: () => void;

  constructor(duracaoMs: number, aoEsgotar: () => void) {
    this.restante = duracaoMs;
    this.aoEsgotar = aoEsgotar;
  }

  /** Tempo que ainda falta, em ms. */
  get tempoRestante(): number {
    if (this.timer === null) return this.restante;
    return Math.max(0, this.restante - (Date.now() - this.inicio));
  }

  get rodando(): boolean {
    return this.timer !== null;
  }

  start(): void {
    if (this.encerrado || this.timer !== null) return;
    this.inicio = Date.now();
    this.timer = setTimeout(() => {
      this.timer = null;
      this.restante = 0;
      this.encerrado = true;
      this.aoEsgotar();
    }, this.restante);
  }

  pause(): void {
    if (this.timer === null) return;
    clearTimeout(this.timer);
    this.timer = null;
    this.restante = Math.max(0, this.restante - (Date.now() - this.inicio));
  }

  resume(): void {
    this.start();
  }

  /** Cancela de vez (limpeza ao desmontar). Não dispara o callback. */
  dispose(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.encerrado = true;
  }
}
