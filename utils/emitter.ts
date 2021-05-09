import {Event, IDispose} from './event';

type IListener<T = any> = [(d: T) => void, any];

export class Emitter<T> implements IDispose {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    private static readonly _noop = function () {};
    private _deliverQueue = new Set<IListener>();
    private _event: Event<T> | null = null;
    private _disposed = false;

    get event(): Event<T> {
        if (this._event === null) {
            this._event = function (
                listener: (e: T) => any,
                thisArgs: any = undefined,
                disposables?: any,
            ) {
                const params: IListener = [listener, thisArgs];
                this._deliverQueue.add(params);
                const result = {
                    dispose: () => {
                        if (this._disposed) return;
                        result.dispose = Emitter._noop;
                        this._deliverQueue.delete(params);
                    },
                };
                return result;
            };
        }
        return this._event;
    }
    public fire(event?: T): void {
        if (this._deliverQueue.size > 0) {
            this._deliverQueue.forEach(listener => {
                const [callback, thisObj] = listener;
                callback.call(thisObj, event);
            });
        }
    }

    public dispose(): void {
        if (!this._disposed) {
            this._disposed = true;
            this._deliverQueue.clear();
        }
    }
}
