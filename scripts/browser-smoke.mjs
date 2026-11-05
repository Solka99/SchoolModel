// Local Chrome QA using its DevTools protocol; no browser-test dependency.
// Start Vite first, then: node scripts/browser-smoke.mjs [URL]
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const url = process.argv[2] || 'http://127.0.0.1:5173/';
  const profile = resolve(`.qa/chrome-profile-${process.pid}`); await mkdir(profile, { recursive: true });
const chrome = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browser = spawn(chrome, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1440,1000', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket;
try {
  let port;
  for (let i = 0; i < 100; i++) {
    try { const data = await readFile(resolve(profile, 'DevToolsActivePort'), 'utf8'); port = Number(data.split('\n')[0]); if (port && (await fetch(`http://127.0.0.1:${port}/json/list`)).ok) break; } catch {}
    await delay(100);
  }
  assert.ok(port, 'Chrome DevTools endpoint');
  const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const tab = tabs.find(t => t.type === 'page');
  socket = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  let next = 0; const pending = new Map(), errors = [], failed = [];
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) { const p = pending.get(message.id); if (!p) return; pending.delete(message.id); message.error ? p.reject(new Error(JSON.stringify(message.error))) : p.resolve(message.result); }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text + ': ' + message.params.exceptionDetails.exception?.description);
    if (message.method === 'Network.responseReceived' && message.params.response.status >= 400) failed.push(message.params.response.url);
  });
  function call(method, params = {}) {
    return new Promise((resolve, reject) => { const id = ++next; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  }
  async function evaluate(expression) {
    const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  }
  async function screenshot(name) {
    const result = await call('Page.captureScreenshot', { format: 'png' });
    await writeFile(resolve(`.qa/${name}.png`), Buffer.from(result.data, 'base64'));
  }
  await call('Page.enable'); await call('Runtime.enable'); await call('Network.enable');
  await call('Page.bringToFront');
  await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await call('Page.navigate', { url });
  let ready = false;
  for (let i = 0; i < 200; i++) {
    ready = await evaluate(`!document.querySelector('#start-button')?.disabled && !!document.querySelector('canvas')`);
    if (ready) break; await delay(100);
  }
  assert.ok(ready, 'Classroom loads');
  assert.equal(await evaluate(`document.body.classList.contains('fatal')`), false);
  await delay(600); await screenshot('welcome');
  const dev = await evaluate('!!window.schoolRush');
  if (dev) {
    const counts = await evaluate(`({chairs:schoolRush.world.objects.filter(o=>o.kind==='chair').length,desks:schoolRush.world.objects.filter(o=>o.kind==='desk').length,assets:schoolRush.models.templates.size})`);
    assert.deepEqual(counts, { chairs: 106, desks: 105, assets: 5 });
    // A real mouse click tests the user-gesture boundary for Pointer Lock.
    const button = await evaluate(`(()=>{const r=document.querySelector('#start-button').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    await call('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...button });
    await call('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...button });
    await delay(300);
    const locked = await evaluate('!!document.pointerLockElement');
    assert.equal(locked, true, 'User click acquires Pointer Lock');
    const startZ = await evaluate('schoolRush.player.feet.z');
    await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'w', code: 'KeyW' });
    await delay(700);
    const movementState = await evaluate(`({running:schoolRush.running,locked:!!document.pointerLockElement,keys:[...schoolRush.input.keys],feet:schoolRush.player.feet.toArray(),visible:!document.hidden})`);
    await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'w', code: 'KeyW' });
    assert.ok((await evaluate('schoolRush.player.feet.z')) > startZ + 0.1, 'Captured keyboard moves the player: '+JSON.stringify(movementState));
    console.log('Pointer Lock and keyboard movement: passed');
    await evaluate(`schoolRush.pause(); document.querySelector('#welcome').hidden=true; schoolRush.view.sync(schoolRush.player.feet);`);
    await delay(100); await screenshot('classroom');
    const checks = await evaluate(`(async()=>{
      const g=schoolRush; const {Vector3}=await import('/node_modules/.vite/deps/three.js');
      const assert=(condition,message)=>{if(!condition)throw new Error(message)};
      // Climb both central aisles with the real hall's furniture colliders.
      for(const x of [-1.95,1.95]){
        g.player.reset(new Vector3(x,0,0.2));
        for(let i=0;i<230;i++)g.player.update(1/120,{x:0,z:1},new Vector3(0,0,1),new Vector3(1,0,0),false,g.world.colliders);
        assert(g.player.feet.z>8.5,'Aisle traversal blocked at '+JSON.stringify(g.player.feet));
        assert(Math.abs(g.player.feet.y-1.4)<0.01,'All seven steps climbed');
      }
      const door=g.world.hall.door; const center=door.panelCollider.box.getCenter(new Vector3());
      g.player.reset(new Vector3(center.x+1,0,center.z));g.view.camera.position.copy(g.player.feet).y+=1.62;g.view.camera.lookAt(center);g.view.camera.updateMatrixWorld();
      assert(g.interactions.findTarget(g.view.camera,g.world.pickables)===door,'Door ray target');
      door.interact();door.interact();
      for(let i=0;i<120;i++)door.update(1/120);
      assert(door.angle===95,'Door opens after handle sequence');
      for(let i=0;i<60;i++)g.player.update(1/120,{x:-1,z:0},new Vector3(0,0,1),new Vector3(1,0,0),false,g.world.colliders);
      assert(g.player.feet.x<center.x-0.5,'Open doorway leads outside');
      door.interact();for(let i=0;i<120;i++)door.update(1/120);assert(door.angle===0,'Door closes');
      const chair=g.world.objects.find(o=>o.kind==='chair');g.interactions.sit(chair);assert(g.interactions.seated===chair,'Sitting');g.interactions.stand();assert(!g.interactions.seated,'Standing');
      const desk=g.world.objects.find(o=>o.kind==='desk');desk.interact();for(let i=0;i<120;i++)desk.update(1/120);assert(desk.angle===90,'Folding desk opens');desk.interact();for(let i=0;i<120;i++)desk.update(1/120);assert(desk.angle===0,'Folding desk closes');
      g.interactions.edit(g.world.hall.blackboard);document.querySelector('#board-text').value='School Rush browser test';document.querySelector('#board-text').dispatchEvent(new Event('input'));assert(g.world.hall.blackboard.text==='School Rush browser test','Board text');g.editor.close();
      g.rebuild({seatRows:4,seatCols:3,doorOnLeft:false});assert(g.world.objects.filter(o=>o.kind==='desk').length===36,'Rebuild counts');
      assert(!g.interactions.editing&&!g.interactions.seated,'Rebuild state cleared');
      g.rebuild();g.respawn();
      g.previewCamera();g.renderer.render(g.world.scene,g.view.camera);
      const before={...g.renderer.info.memory};
      for(let i=0;i<5;i++){g.setDebug(i%2===0);g.rebuild();g.setDebug(false);g.previewCamera();g.renderer.render(g.world.scene,g.view.camera);}
      const after={...g.renderer.info.memory};
      assert(after.geometries===before.geometries&&after.textures===before.textures,'Rebuild resources grow: '+JSON.stringify({before,after}));
      return {objects:g.world.objects.length,colliders:g.world.colliders.length,memory:after,checks:'passed'};
    })()`);
    console.log('Real hall checks:', JSON.stringify(checks));
    // Paused views allow visual inspection without pointer lock.
    await evaluate(`document.querySelector('#welcome').hidden=true; schoolRush.view.camera.position.set(0,2.7,9.5); schoolRush.view.camera.lookAt(0,1,-2.8);`);
    await delay(150); await screenshot('rear-view');
    await evaluate(`document.querySelector('#welcome').hidden=false; schoolRush.parameters.open();`);
    await screenshot('settings');
    await evaluate(`schoolRush.parameters.dialog.close();`);
  }
  await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, 'Narrow-screen overlay fits');
  await screenshot('narrow-screen');
  assert.deepEqual(errors, [], 'No browser exceptions'); assert.deepEqual(failed, [], 'No failed application requests');
  console.log('Browser smoke passed:', url, 'Screenshots in .qa/');
} finally {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ id: 999999, method: 'Browser.close' }));
    await delay(150);
  }
  socket?.close(); browser.kill();
}
