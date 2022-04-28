import { utilitas, webjam } from './index.mjs';

await webjam.init({});
await utilitas.timeout(3000);
await webjam.end();
