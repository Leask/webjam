import { utilitas, websrv } from './index.mjs';

await websrv.init({});
await utilitas.timeout(3000);
await websrv.end();
