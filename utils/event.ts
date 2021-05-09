export interface IDispose {
    dispose(): void;
}
export type Event<T = any> = (
    listener: (e: T) => any,
    thisArgs?: any,
    disposables?: any,
) => IDispose;
export namespace Event {
    export function test(): void {
        console.log('test');
    }
}
