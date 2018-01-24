import { fromDot, getQueryString } from './misc'
import { Container } from './Container'
import {
  Processor,
  Modifier,
  MethodSet,
  ContainerSet,
  ContainerBase,
  QueryMethod,
  ContainerBases
} from './interfaces'
import { DEFAULTS } from './defaults';

export class BaseModel<Parent> {
  [key: string]: any

  private processors: MethodSet = {}
  private modifiers: MethodSet = {}
  private described_containers: any = {}

  public parent: Parent
  public containers: ContainerSet<Parent> = {}
  public interceptor: (resp: any) => any

  constructor (parent: Parent = null) {
    this.parent = parent
    this.addFieldProcessorsBulk({
      'int': (value: any) => !value ? 0 : (parseInt(value) ? +parseInt(value) : 0),
      'string': (value: any) => (typeof value) == 'string' ? value : (!value ? '' : ''+value),
      'array': (value: any) => Array.isArray(value) ? value : [],
      'bool': (value: any) => value ? true : false,
      // Processors for testing:
      'usd': (value: any) => value.toString() != 'NaN' ? (value.toString().indexOf('$') < 0 ? value+'$' : value) : value,
      'kzt': (value: any) => value.toString() != 'NaN' ? (value.toString().indexOf('₸') < 0 ? value+'₸' : value) : value
    })
  }

  /**
   * Sets a Proxy alias for the container
   * to the root of this class
   * @param container_name Container name
   */
  public setProxy (container_name: string): void {
    if (this.getContainer(container_name)) {
      let original: any = this.containers[container_name].data
      let proxy_name: string = `${DEFAULTS.CONTAINER_PROXY_PREFIX}${container_name}`
      this[proxy_name] = new Proxy(original, {})
    } else {
      console.error(`
        BaseAjax::setProxy()
        Container ${container_name} not found
      `)
    }
  }

  /**
   * Creates a method to proceed a processors chain
   * @param names Processors chain
   */
  private createProcessorCallie (names: string): (data: any) => any {
    let names_ar: string[] = names.split('.')
    return (data: any) => {
      let is_stop: boolean = false
      let acc: any = data
      for (let name of names_ar) {
        // check if there is a modifier
        if (name.indexOf(`:`) >= 0) {
          let full_mod: string[] = name.split(':')
          let mod_name: string = full_mod[0]
          let mod_params: any = JSON.parse(full_mod[1])
          if (this.modifiers[mod_name]) {
            let mod_result: any = this.modifiers[mod_name](acc, mod_params)
            acc = mod_result.value || acc
            is_stop = mod_result.break || is_stop
          }
          if (is_stop) {
            break
          }
        } else {
          acc = this.proceedProcessor(name, acc)
        }
      }
      return acc
    }
  }

  /**
   * Gets a container
   * @param name Container name
   */
  protected getContainer (name: string): Container<Parent> {
    return this.containers[name]
  }

  /**
   * Proceeds the processor
   * @param name Processor name
   * @param data Data to proceed
   */
  private proceedProcessor (name: string, data: any): any {
    if (this.processors[name])
      return this.processors[name](data)
    else
      return undefined
  }

  /**
   * Adds new containers to the model
   * @param containers Array of containers
   */
  public addContainer: {
    (name: string, fields: { [key: string]: string }, source?): BaseModel<Parent>;
    (container: ContainerBase): BaseModel<Parent>;
  } = function() {
    if (arguments.length >= 2) {
      var full_name = arguments[0]
      var fields = arguments[1]
      var source = arguments[2]
    } else {
      const base: ContainerBase = arguments[0];
      full_name = base.name
      fields = base.fields
      source = base.source
    }
    let extended_fields: any = this.getExtendedFields(full_name)
    let name: string = full_name
    if (extended_fields) {
      fields = { ...fields, ...extended_fields.extended }
      name = extended_fields.name
    }
    let new_container = new Container(this, name, fields, source)
    this.containers[name] = new_container
    this.setProxy(name)
    return this;
  }

  public addContainers:{
    (containers: ContainerBases): BaseModel<Parent>
    (containers: ContainerBase[]): BaseModel<Parent>
  } = containers => {
    if (Array.isArray(containers))
      containers.forEach(this.addContainer);
    for (let name in containers) {
      const { fields, source } = containers[name]
      this.addContainer(name, fields, source)
    }
    return this
  }

  /**
   * Gets the extended fields for controller.
   * @param name The name
   * @return The extended fields.
   */
  public getExtendedFields (name: string): (any|boolean) {
    const keyword: string = ' extends '
    let is_extends: boolean = !!~name.indexOf(keyword)
    if (is_extends) {
      let name_splitted: string[] = name.split(keyword).map((el: string) => el.replace(/\s/g, ''))
      let extended: any = {}
      // Several extends
      if (~name_splitted[1].indexOf('[')) {
        let extends_arr: string[] = name_splitted[1]
          .replace(/[\[\]]/g, '')
          .split(',')

        extends_arr.forEach((el: string) => {
          if (this.described_containers[el]) {
            extended = { ...extended, ...this.described_containers[el] }
          }
        })
      }
      else {
        if (this.described_containers[name_splitted[1]]) {
          extended = { ...extended, ...this.described_containers[name_splitted[1]] }
        }
      }
      return { name: name_splitted[0], extended }
    } else {
      return false
    }
  }

  /**
   * Describe basic container
   *
   * @param      {string}  full_name  The full name
   * @param      {Object}  fields     The fields
   */
  describeContainer (full_name, fields = {}) {
    let extended_fields = this.getExtendedFields(full_name)
    let name = full_name

    if (extended_fields) {
      fields = { ...fields, ...extended_fields.extended }
      name = extended_fields.name
    }

    this.described_containers[name] = fields
    return this
  }

  /**
   * Gets a real processor name
   * (ex. from '@container_name.some_field')
   * @param name Processor name
   */
  public getProcessor (name: string): string {
    if (~name.indexOf('@')) {
      let splitted_keys: string[] = name.replace('@','').split('.')
      let container_name: string = splitted_keys[0]
      let container: any = this.getContainer(container_name)
      if (container) {
        let property_name: string = splitted_keys.slice(-1).join('')
        let processor_name: string = container.fields[property_name]
        if (~processor_name.indexOf('@')) {
          return this.getProcessor(processor_name)
        } else {
          return processor_name
        }
      }
    } else {
      return name
    }
  }

  /**
   * Adds a new modifier
   * @param params Name and a callback for a new modifier
   */
  public addModifier (params: Modifier): BaseModel<Parent> {
    let name: string = params.name || null
    let callie: (...args) => any = params.proc || null
    if (!name || !callie) {
      console.error(`
        BaseAjax::addModifier()
        You should specify both name and callback
      `)
      return this
    }
    this.modifiers[name] = callie
    return this
  }

  /**
   * Adds a new processor
   * @param params Name and a callback for a new processor
   */
  public addFieldProcessor (params: Processor): BaseModel<Parent> {
    let name: string = params.name
    let callie: (...args) => any = params.proc
    if (!name || !callie) {
      console.error(`
        BaseModel::addFieldProcessor()
        You should specify both name and callback
      `)
      return this
    }
    this.processors[name] = callie
    return this
  }

  /**
   * Adds new processors
   * @param processors Names and a callbacks for new processors
   */
  public addFieldProcessorsBulk (processors: MethodSet): BaseModel<Parent> {
    this.processors = { ...this.processors, ...processors }
    return this
  }

  /**
   * Adds new modifiers
   * @param modifiers Names and a callbacks for new modifiers
   */
  public addModifiersBulk (modifiers: MethodSet): BaseModel<Parent> {
    this.modifiers = { ...this.modifiers, ...modifiers }
    return this
  }

  /**
   * Gets a field value from a container
   * @param container_name Container name
   * @param field Field name
   */
  private getFieldFromContainer (container_name: string, field: string) {
    let container: Container<Parent> = this.getContainer(container_name)
    let context_group = container ? container.data : null
    if (!context_group) {
      console.error(`BaseModel::getFieldFromContainer() Container ${container_name} not found`)
    }
    return fromDot(context_group, field)
  }

  /**
   * Generates a method for a query
   * @param params Custom params and Fetch params
   */
  public generateQuery (params: any): () => void {
    let uri: string = params.uri
    let method: QueryMethod = (params.method || DEFAULTS.QUERY_METHOD).toUpperCase()
    let container_name: string = params.container || null
    let container: any

    if (container_name) {
      container = this.getContainer(container_name)
    }

    let data: any = container ? this.getFields(container_name) : (params.data || null)
    let mode: any = params.mode
    let headers: any = params.headers || {}
    let credentials: any = params.credentials
    let check: string = params.check || 'status'
    let is_json: boolean = (params.json === true || params.json === false) ? params.json : DEFAULTS.IS_JSON_RESPONSE

    if (method == 'GET' && data) {
      uri = uri + (!~uri.indexOf('?')?'?':'&') + getQueryString(data)
    } else if (method != 'GET') {
      data = JSON.stringify(data)
    }

    let result: () => void = () => {
      return new Promise((resolve, reject) => {
        fetch(uri, {
          headers: new Headers(Object.assign({},headers)),
          credentials,
          method,
          mode,
          body: data
        }).then((response) => {
          if (this.interceptor) {
            let is_continue: boolean = this.interceptor(response)
            if (!is_continue) {
              reject()
            }
          }
          if (!response.ok) {
            reject()
          }
          if (is_json) {
            response.json().then((json: string) => {
              resolve(json)
            }).catch(() => {
              let err: any = new Error('Json parse error')
              err.type = 'json'
              reject(err)
            })
          } else {
            response.text().then((text: string) => {
              resolve(text)
            }).catch(() => {
              let err: any = new Error('Text retrieve error')
              err.type = 'text'
              reject(err)
            })
          }
        }).catch((error: any) => {
          reject(error)
        })
      })
    }
    return result
  }

  /**
   * Parses an expression
   * Note:  Due to some restrictions
   *        you should only compare
   *        fields with the boolean values
   *        ex.: if(&.someGetter == false)
   * @param expression Conditional expression
   */
  private parseCondition (expression: string): boolean {
    let items: string[] = expression.split(' ')
    for (let i in items) {
      let splitted_keys: string[] = items[i].split('.')
      if (splitted_keys.length) {
        let model_path: string = splitted_keys.slice(1, -1).join('.')
        let property_name: string = splitted_keys.slice(-1).join('')
        // from parent
        if (splitted_keys[0] == '^') {
          items[i] = fromDot(this.parent, model_path)[property_name]
        }
        // from self class
        if (splitted_keys[0] == '&') {
          items[i] = fromDot(this, model_path)[property_name]
        }
        // from container
        if (splitted_keys[0] == '@') {
          let container_name = splitted_keys[0].replace('@','')
          items[i] = this.getFieldFromContainer(container_name, model_path)[property_name]
        }
      }
    }
    expression = items.join(' ')
    return Function.apply(null, [].concat('return ' + expression))()
  }

  /**
   * Gets proceeded fields from a container
   * @param container_name Container name
   */
  private getFields (container_name: string): any {
    let container: Container<Parent> = this.getContainer(container_name)

    if (!Object.keys(container.fields).length) {
      console.error(`
        BaseModel::getFields()
        You have to specify field names
      `)
      return {}
    }
    if (!container.fields) {
      return container.data || {}
    }
    let result: any = {}
    Object.keys(container.fields)
      .map((el: string) => {
        let model: any = container.data
        let field_name: string = el
        let property_name: string = el
        let value: any = null
        let external_value: any = null
        let is_external: boolean = false

        // has condition:
        let condition: string[] = el.match(/if\((.+)\)/i)
        let condition_result: boolean = true
        if (condition && condition.length > 1) {
          condition_result = this.parseCondition(condition[1])
        }

        // if add this field
        if (condition_result) {
          // is external:
          if (~el.indexOf('.')) {
            let keys: string = el.split(' ')[0]
            let splitted_keys: string[] = keys.split('.')
            property_name = splitted_keys.slice(-1).join('')
            // now we see - it's an external field
            if (splitted_keys[0] == '^' || splitted_keys[0] == '&' || splitted_keys[0].indexOf('@') === 0) {
              is_external = true
              let model_path: string = splitted_keys.slice(1, -1).join('.')
              // from container
              if (splitted_keys[0].indexOf('@') === 0) {
                let tmp_container_name: string = splitted_keys[0].replace('@','')
                model = this.getFieldFromContainer(tmp_container_name, model_path)
              } else
              // from parent
              if (splitted_keys[0] == '^' && this.parent) {
                model = fromDot(this.parent, model_path)
              } else
              // from self class
              if (splitted_keys[0] == '&') {
                model = fromDot(this, model_path)
              }
            }
            if (!model) {
              console.error(`BaseModel::getFields() Field ${el} not found`)
            }
            external_value = model[property_name]
            field_name = property_name
          }

          let el_without_cond: string = el.replace(/if\((.+)\)/ig, '').trim()

          // is alias:
          if (~el_without_cond.indexOf(' as ')) {
            let keys: string[] = el_without_cond.split(' as ')
            if (!is_external) {
              property_name = keys[0]
            }
            field_name = keys[1]
          }

          value = is_external ? external_value : model[property_name]
          let proc_names: string = this.getProcessor(container.fields[el])
          let processors: (data: any) => any = this.createProcessorCallie(proc_names)
          result[field_name] = processors ? processors(value) : value
        }
      })
    return result
  }

}
