export interface Event {
    addEventListener(): void;
    releaseEvents(): void;
}

namespace Event {}

class Emitter {}
