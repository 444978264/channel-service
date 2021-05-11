import {Event} from '../utils/event';

setTimeout(() => {
    window.postMessage(
        {
            target: 'ipc.hello',
            data: {
                name: 'cyf',
            },
        },
        '*',
    );
}, 1000);

const haha = Event.from<{target: string; data: Record<string, any>}>(
    window,
    'message',
    function (e) {
        return e.data;
    },
);

const filter = Event.filter(haha, data => {
    return data.target.startsWith('ipc.');
});

const aa = filter(e => {
    console.log(e.target, 'filter');
    aa.dispose();
});
