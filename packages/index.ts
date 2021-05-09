import {Event} from '../utils/event';

window.addEventListener('message', e => {
    const {data} = e;
    if (data.target.startsWith('ipc.')) {
        console.log(e, origin, 'message');
    }
});

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
