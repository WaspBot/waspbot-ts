/**
 * @fileoverview Shared bot state manager for WaspBot-TS
 */

export interface IStorageProvider<TState> {
  save(state: TState): Promise<void>;
  load(): Promise<TState | null>;
}

export class InMemoryStorageProvider<TState> implements IStorageProvider<TState> {
  private state: TState | null = null;

  async save(state: TState): Promise<void> {
    this.state = state;
  }

  async load(): Promise<TState | null> {
    return this.state;
  }
}

export class StateManager<TState extends object> {
  private _state: TState;
  private storageProvider: IStorageProvider<TState>;

  constructor(initialState: TState, storageProvider?: IStorageProvider<TState>) {
    this._state = initialState;
    this.storageProvider = storageProvider || new InMemoryStorageProvider<TState>();
  }

  async init(): Promise<void> {
    const loadedState = await this.storageProvider.load();
    if (loadedState !== undefined && loadedState !== null) {
      this._state = loadedState;
    }
  }

  async setState(newState: Partial<TState>): Promise<void> {
    this._state = { ...this._state, ...newState };
    await this.storageProvider.save(this._state);
  }

  getState(): TState {
    return { ...this._state };
  }
}