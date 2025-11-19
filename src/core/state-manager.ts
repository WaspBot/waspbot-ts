/**
 * @fileoverview Shared bot state manager for WaspBot-TS
 */

export interface IStorageProvider {
  save(state: any): Promise<void>;
  load(): Promise<any | null>;
}

export class InMemoryStorageProvider implements IStorageProvider {
  private state: any | null = null;

  async save(state: any): Promise<void> {
    this.state = state;
  }

  async load(): Promise<any | null> {
    return this.state;
  }
}

export class StateManager {
  private _state: any = {};
  private storageProvider: IStorageProvider;

  constructor(storageProvider?: IStorageProvider) {
    this.storageProvider = storageProvider || new InMemoryStorageProvider();
  }

  async init(): Promise<void> {
    const loadedState = await this.storageProvider.load();
    if (loadedState) {
      this._state = loadedState;
    }
  }

  async setState(newState: Partial<any>): Promise<void> {
    this._state = { ...this._state, ...newState };
    await this.storageProvider.save(this._state);
  }

  getState(): any {
    return this._state;
  }
}