import { Container } from './Container'

export interface Processor {
  name: string,
  proc: (...params) => any
}

export interface Modifier {
  name: string,
  proc: (...params) => any
}

export interface MethodSet {
  [key: string]: (...args) => any
}

export interface ContainerSet<T> {
  [key: string]: Container<T>
}

export interface ContainerBases {
  [name: string]: {
    fields: { [key: string]: string }
    source?: any
  }
}

export interface ContainerBase {
  name: string
  fields: { [key: string]: string }
  source?: any
}

export interface RequestParameters {
  uri: string
  method: QueryMethod
  container: string
  mode: any
  headers: { [key: string]: string }
  credentials: any
  check: string
  json: boolean
}

export type QueryMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'OPTIONS' | 'PATCH' | 'COPY' | 'HEAD' | 'VIEW' //...may as well continue...
