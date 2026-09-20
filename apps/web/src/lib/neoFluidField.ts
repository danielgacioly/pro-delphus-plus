export class NeoFluidField {
  private front: Float32Array
  private back: Float32Array
  private previous: { x: number; y: number } | null = null
  private readonly columns: number
  private readonly rows: number

  constructor(aspect: number) {
    const resolution = 48
    this.columns = aspect >= 1 ? resolution : Math.max(24, Math.round(resolution * aspect))
    this.rows = aspect >= 1 ? Math.max(24, Math.round(resolution / aspect)) : resolution
    this.front = new Float32Array(this.columns * this.rows * 3)
    this.back = new Float32Array(this.front.length)
  }

  get gridColumns() {
    return this.columns
  }

  get gridRows() {
    return this.rows
  }

  move(x: number, y: number) {
    const previous = this.previous ?? { x, y }
    this.previous = { x, y }
    const dx = Math.max(-0.08, Math.min(0.08, x - previous.x))
    const dy = Math.max(-0.08, Math.min(0.08, y - previous.y))
    if (Math.abs(dx) + Math.abs(dy) < 0.0001) return

    const radius = 0.08
    for (let row = 0; row < this.rows; row++) {
      for (let column = 0; column < this.columns; column++) {
        const u = column / (this.columns - 1)
        const v = row / (this.rows - 1)
        const distance = Math.hypot((u - x) * Math.max(1, this.columns / this.rows), v - y)
        if (distance > radius) continue
        const weight = Math.exp(-(distance * distance) / 0.002)
        const index = (row * this.columns + column) * 3
        this.front[index] += dx * weight * 2.8
        this.front[index + 1] += dy * weight * 2.8
        this.front[index + 2] = Math.min(1, this.front[index + 2] + weight * 0.25)
      }
    }
  }

  leave() {
    this.previous = null
  }

  step(seconds: number) {
    const decay = Math.exp(-seconds * 2.6)
    for (let index = 0; index < this.front.length; index += 3) {
      const nextX = this.front[index] * decay
      const nextY = this.front[index + 1] * decay
      const ink = this.front[index + 2] * Math.exp(-seconds * 3.2)
      this.back[index] = nextX
      this.back[index + 1] = nextY
      this.back[index + 2] = ink
    }
    ;[this.front, this.back] = [this.back, this.front]
  }

  /**
   * Reaproveita o mesmo objeto de saída: `sample` roda uma vez por célula por
   * quadro (milhares por segundo) e alocar aqui vira pressão de GC constante.
   * Quem chama deve ler os campos antes da próxima chamada.
   */
  private readonly out = { x: 0, y: 0, density: 0 }

  sample(column: number, row: number, time: number) {
    const index = (row * this.columns + column) * 3
    const flowX = this.front[index] ?? 0
    const flowY = this.front[index + 1] ?? 0
    const ink = this.front[index + 2] ?? 0
    const u = column / this.columns
    const v = row / this.rows
    const wave = Math.sin(u * 8 + time * 0.16) + Math.sin(v * 7 - time * 0.12)
    this.out.x = flowX
    this.out.y = flowY
    this.out.density = Math.max(0, Math.min(1, 0.5 + wave * 0.18 + ink * 1.8))
    return this.out
  }
}
