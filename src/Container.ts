import { BaseModel } from './BaseModel'

export class Container<T> {
  private model: BaseModel<T>
  public data: any = {}
  public name: string
  public fields: any = {}

  constructor (model: BaseModel<T>, name: string, fields: any, source?) {
    this.model = model
    this.name = name
    this.fields = fields

    if (source) {
      this.data = new Proxy(source, {})
    }
  }

  /**
   * Sets a external source for a container
   * @param source Data source
   */
  public setSource (source: any): void {
    this.data = new Proxy(source, {})
    this.model.setProxy(this.name)
  }
}
