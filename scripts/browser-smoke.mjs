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
  assert.ok(ready, 'School loads');
  assert.equal(await evaluate(`document.body.classList.contains('fatal')`), false);
  await delay(600); await screenshot('welcome');
  const dev = await evaluate('!!window.schoolRush');
  if (dev) {
    const counts = await evaluate(`({chairs:schoolRush.world.objects.filter(o=>o.kind==='chair').length,desks:schoolRush.world.objects.filter(o=>o.kind==='desk').length,assets:schoolRush.models.templates.size})`);
    assert.deepEqual(counts, { chairs: 318, desks: 315, assets: 5 });
    // A real mouse click tests the user-gesture boundary for Pointer Lock.
    const button = await evaluate(`(()=>{const r=document.querySelector('#start-button').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    await call('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...button });
    await call('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...button });
    await delay(300);
    const locked = await evaluate('!!document.pointerLockElement');
    assert.equal(locked, true, 'User click acquires Pointer Lock');
    const startZ = await evaluate('schoolRush.player.feet.z');
    await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'w', code: 'KeyW' });
    for(let i=0;i<50;i++) {
      if((await evaluate('schoolRush.player.feet.z')) > startZ + 0.1) break;
      await delay(100);
    }
    const movementState = await evaluate(`({running:schoolRush.running,locked:!!document.pointerLockElement,keys:[...schoolRush.input.keys],feet:schoolRush.player.feet.toArray(),visible:!document.hidden})`);
    await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'w', code: 'KeyW' });
    assert.ok((await evaluate('schoolRush.player.feet.z')) > startZ + 0.1, 'Captured keyboard moves the player: '+JSON.stringify(movementState));
    console.log('Pointer Lock and keyboard movement: passed');
    await evaluate(`schoolRush.pause(); document.querySelector('#welcome').hidden=true; schoolRush.view.sync(schoolRush.player.feet);`);
    await delay(100); await screenshot('classroom');
    const checks = await evaluate(`(async()=>{
      const g=schoolRush; const {Vector3,Box3,WebGLRenderTarget}=await import('/node_modules/.vite/deps/three.js');
      const assert=(condition,message)=>{if(!condition)throw new Error(message)};
      const F=new Vector3(0,0,1),R=new Vector3(1,0,0);
      function aim(object,point){
        g.view.camera.position.copy(g.player.feet).y+=1.62;
        object.root.updateWorldMatrix(true,true);
        g.view.camera.lookAt(point||new Box3().setFromObject(object.root).getCenter(new Vector3()));g.view.camera.updateMatrixWorld();
        g.interactions.update();
        assert(g.interactions.target===object,'Aim at '+object.label+'; got '+g.interactions.target?.label);
      }
      function brightness(room){
        const cam=g.view.camera,pos=cam.position.clone(),rotation=cam.quaternion.clone(),previous=g.renderer.getRenderTarget();
        const target=new WebGLRenderTarget(96,64),pixels=new Uint8Array(96*64*4);
        cam.position.set(room.origin[0],2.7,room.bounds.maxZ-0.7);cam.lookAt(room.origin[0],1.2,room.bounds.minZ);cam.updateMatrixWorld();
        g.interactions.highlight.clear();g.renderer.setRenderTarget(target);g.renderer.render(g.world.scene,cam);g.renderer.readRenderTargetPixels(target,0,0,96,64,pixels);
        g.renderer.setRenderTarget(previous);target.dispose();cam.position.copy(pos);cam.quaternion.copy(rotation);cam.updateMatrixWorld();
        let sum=0;for(let i=0;i<pixels.length;i+=4)sum+=pixels[i]+pixels[i+1]+pixels[i+2];return sum/(96*64*3);
      }
      function move(x,z){
        for(let i=0;i<3000;i++){
          const dx=x-g.player.feet.x,dz=z-g.player.feet.z,d=Math.hypot(dx,dz);
          if(d<0.045){for(let j=0;j<30;j++)g.player.update(1/120,{x:0,z:0},F,R,false,g.world.colliders);return;}
          g.player.update(1/120,{x:dx/d,z:dz/d},F,R,false,g.world.colliders);
        }
        throw new Error('Walk blocked: '+JSON.stringify({target:[x,z],feet:g.player.feet.toArray()}));
      }
      function open(door){
        g.view.camera.position.copy(g.player.feet).y+=1.62;g.view.camera.lookAt(door.panelCollider.box.getCenter(new Vector3()));g.view.camera.updateMatrixWorld();
        assert(g.interactions.findTarget(g.view.camera,g.world.pickables)===door,'Reachable door ray target');
        g.interactions.target=door;g.interactions.activate();
        for(let i=0;i<120;i++)g.world.update(1/120,g.player.box);
        assert(door.angle===95,'Door opens without hitting player');
      }
      // Continuous route: no teleports between entrance, corridor, or classrooms.
      g.respawn();
      const hallSwitch=g.world.school.corridor.lightSwitch;
      move(g.world.school.params.corridorWidth/2-0.9,4.8);aim(hallSwitch);
      assert(g.interactions.highlight.helper.visible,'Switch target is highlighted');
      assert(g.interactions.activate(),'Corridor switch activates');assert(!g.world.school.corridor.lighting.on,'Corridor lights turn off');
      assert(g.world.school.rooms.every(r=>r.classroom.lighting.on),'Classroom circuits stay on');
      g.interactions.activate();assert(g.world.school.corridor.lighting.on,'Corridor lights turn on');move(0,4.8);move(0,1.5);
      const entrance=g.world.school.corridor.entranceDoor;open(entrance);move(0,-1.4);
      assert(g.world.school.locationAt(g.player.feet).includes('ENTRANCE'),'Exit onto entrance landing');move(0,1.5);
      const visited=[],lighting=[];
      for(const room of g.world.school.rooms){
        const c=room.classroom,m=c.metrics,p=c.params,dx=room.door[0],dz=room.door[2],side=room.side;
        move(0,dz);move(dx-side*1.6,dz);
        // Verify the closed panel blocks the physical route, then step back to open it.
        for(let i=0;i<70;i++)g.player.update(1/120,{x:side,z:0},F,R,false,g.world.colliders);
        assert(side*(g.player.feet.x-dx)<0,'Closed door blocks passage');move(dx-side*1.6,dz);
        open(c.door);move(dx+side,dz);
        assert(g.world.school.locationAt(g.player.feet).includes(room.number),'Enter room '+room.number);
        aim(c.lightSwitch);
        assert(document.querySelector('#prompt').textContent.includes(room.number),'Prompt names the room');
        const on=brightness(room);aim(c.lightSwitch);assert(g.interactions.activate(),'Light switch action');
        const off=brightness(room);
        assert(!c.lighting.on && c.lighting.lights.every(l=>l.intensity===0),'Room sources turn off');
        assert(g.world.school.rooms.filter(r=>r!==room).every(r=>r.classroom.lighting.on),'Other room circuits are unchanged');
        assert(on>off*1.08,'Room visibly darkens: '+JSON.stringify({room:room.number,on,off}));
        aim(c.lightSwitch);assert(c.lightSwitch.message==='Switch lights on','Context prompt changes');g.interactions.activate();
        assert(c.lighting.on,'Room lights turn back on');lighting.push({room:room.number,on,off});
        move(dx+side,room.origin[2]+0.9);
        const aisle=room.origin[0]-m.seatingWidth/2+m.sectionWidth+p.aisleWidth/2;
        move(aisle,room.origin[2]+0.9);move(aisle,room.bounds.maxZ-0.6);
        assert(Math.abs(g.player.feet.y-p.seatRows*p.rowHeight)<0.01,'Climb translated tiers '+room.number);
        move(aisle,room.origin[2]+0.9);move(dx+side,room.origin[2]+0.9);move(dx+side,dz);
        const chair=c.objects.find(o=>o.kind==='chair');move(dx+side,chair.seat.z+0.9);move(chair.seat.x,chair.seat.z+0.9);
        aim(chair);assert(g.interactions.activate(),'Chair ray action '+room.number);assert(g.interactions.seated===chair,'Sitting '+room.number);
        assert(!g.interactions.edit(c.blackboard),'Seated mode blocks board editing');g.input.pressed.add('Space');g.step(1/120);
        assert(!g.interactions.seated&&g.player.verticalSpeed===0,'Space stands without jumping');
        move(dx+side,chair.seat.z+0.9);
        const desk=c.objects.find(o=>o.kind==='desk');move(dx+side,desk.root.position.z+room.origin[2]-0.8);move(desk.root.position.x+room.origin[0],desk.root.position.z+room.origin[2]-0.8);
        aim(desk);assert(g.interactions.activate(),'Desk ray action '+room.number);assert(!desk.canInteract,'Animating desk is busy');
        for(let i=0;i<120;i++)desk.update(1/120);assert(desk.angle===90,'Desk opens '+room.number);
        aim(desk);g.interactions.activate();for(let i=0;i<120;i++)desk.update(1/120);
        move(dx+side,desk.root.position.z+room.origin[2]-0.8);move(dx+side,dz);
        const boardX=room.origin[0]-side*1.8,boardZ=room.bounds.minZ+1.25;
        move(boardX,boardZ);aim(c.blackboard,new Vector3(boardX,1.6,room.bounds.minZ+0.065));
        assert(g.interactions.activate(),'Blackboard ray action '+room.number);
        assert(!g.input.enabled&&!g.running&&!g.interactions.highlight.helper.visible,'Board editor isolates gameplay input');
        const textarea=document.querySelector('#board-text');textarea.value='Room '+room.number;textarea.dispatchEvent(new Event('input'));
        document.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW',key:'w',bubbles:true}));assert(g.input.keys.size===0,'Typing does not move the player');
        assert(c.blackboard.text==='Room '+room.number,'Independent board '+room.number);g.editor.close();
        assert(!g.interactions.editing&&g.input.enabled,'Closing editor clears mode immediately');
        move(dx+side,dz);
        move(dx-side*1.6,dz);move(0,dz);visited.push(room.number);
      }
      assert(new Set(g.world.school.rooms.map(r=>r.classroom.blackboard.text)).size===3,'Boards have independent state');
      move(0,1.5);
      g.rebuild({seatRows:4,seatCols:3,corridorWidth:3,frontMargin:1.5,roomHeight:3.2});assert(g.world.objects.filter(o=>o.kind==='desk').length===108,'Rebuild counts');
      assert(g.world.school.rooms.every(r=>r.classroom.lighting.on)&&g.world.school.corridor.lighting.on,'Rebuild restores light defaults');
      assert(!g.interactions.editing&&!g.interactions.seated,'Rebuild state cleared');
      for(const room of g.world.school.rooms){
        const [x,,z]=room.door;move(0,z);move(x-room.side*1.6,z);open(room.classroom.door);move(x+room.side,z);
        assert(g.world.school.locationAt(g.player.feet).includes(room.number),'Enter rebuilt room '+room.number);
        move(0,z);
      }
      g.rebuild();g.respawn();
      g.previewCamera();g.renderer.render(g.world.scene,g.view.camera);
      const before={...g.renderer.info.memory};
      for(let i=0;i<5;i++){g.setDebug(i%2===0);g.rebuild();g.setDebug(false);g.previewCamera();g.renderer.render(g.world.scene,g.view.camera);}
      const after={...g.renderer.info.memory};
      assert(after.geometries===before.geometries&&after.textures===before.textures,'Rebuild resources grow: '+JSON.stringify({before,after}));
      return {visited,lighting,rebuiltRoutes:'passed',objects:g.world.objects.length,colliders:g.world.colliders.length,memory:after,checks:'passed'};
    })()`);
    console.log('School traversal checks:', JSON.stringify(checks));
    async function key(key,code,virtualKey,modifiers=0,text) {
      await call('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:virtualKey,modifiers,...(text?{text}: {})});
      await call('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:virtualKey});
    }
    const editorFeet = await evaluate(`(()=>{const g=schoolRush;g.player.feet.set(0.4,0,2.2);g.interactions.edit(g.world.school.rooms[0].classroom.blackboard);g.editor.input.value='';g.editor.sync();return g.player.feet.toArray()})()`);
    await call('Input.insertText',{text:'x'.repeat(230)});
    assert.equal(await evaluate('schoolRush.editor.input.value.length'),200,'Board enforces 200-character limit');
    await key('Delete','Delete',46);
    assert.equal(await evaluate('schoolRush.editor.board.text'),'','Delete clears the board');
    await call('Input.insertText',{text:'Environmental interactions'});
    await key('Enter','Enter',13,8,'\r');
    assert.equal(await evaluate(`document.querySelector('#editor-dialog').open&&schoolRush.editor.input.value.includes(String.fromCharCode(10))`),true,'Shift+Enter adds a line without leaving the editor');
    await key('r','KeyR',82,0,'r');
    assert.deepEqual(await evaluate('schoolRush.player.feet.toArray()'),editorFeet,'Typing R does not respawn');
    assert.equal(await evaluate('schoolRush.input.keys.size'),0,'Editor leaves no gameplay keys held');
    await key('Escape','Escape',27);
    assert.equal(await evaluate(`!document.querySelector('#editor-dialog').open&&!schoolRush.interactions.editing&&schoolRush.input.enabled`),true,'Escape finishes editing cleanly');
    await evaluate(`schoolRush.interactions.edit(schoolRush.world.school.rooms[0].classroom.blackboard);`);
    await key('Enter','Enter',13);
    assert.equal(await evaluate('!schoolRush.interactions.editing'),true,'Enter finishes editing cleanly');
    await evaluate(`schoolRush.interactions.edit(schoolRush.world.school.rooms[0].classroom.blackboard);schoolRush.world.school.rooms[0].classroom.lightSwitch.interact();schoolRush.rebuild();`);
    assert.equal(await evaluate(`!document.querySelector('#editor-dialog').open&&!schoolRush.interactions.editing&&schoolRush.input.enabled&&schoolRush.world.school.rooms.every(r=>r.classroom.lighting.on)`),true,'Rebuild clears editor state and resets circuits');
    console.log('Board keyboard and rebuild checks: passed');
    // Paused views allow visual inspection without pointer lock.
    await evaluate(`document.querySelector('#welcome').hidden=true; schoolRush.view.camera.position.set(0,1.62,12); schoolRush.view.camera.lookAt(0,1.62,0);`);
    await delay(150); await screenshot('corridor');
    await evaluate(`const r=schoolRush.world.school.rooms[0];schoolRush.view.camera.position.set(r.origin[0],2.7,r.bounds.maxZ-0.7);schoolRush.view.camera.lookAt(r.origin[0],1,r.bounds.minZ);`);
    await delay(150); await screenshot('classroom-interior');
    await evaluate(`schoolRush.world.school.rooms[0].classroom.lightSwitch.interact();`);
    await delay(150); await screenshot('lights-off');
    await evaluate(`schoolRush.world.school.rooms[0].classroom.lightSwitch.interact();`);
    await delay(150); await screenshot('lights-on');
    await evaluate(`(()=>{const g=schoolRush,r=g.world.school.rooms[0],s=r.classroom.lightSwitch,p=s.root.getWorldPosition(s.root.position.clone());g.player.reset(p.clone().setY(0).add({x:0.9,y:0,z:0}));g.view.sync(g.player.feet);g.view.camera.lookAt(p);g.view.camera.updateMatrixWorld();g.interactions.update();document.body.classList.add('playing')})()`);
    await screenshot('interaction-target');
    await evaluate(`schoolRush.interactions.clearTarget();schoolRush.hud.setPrompt('');document.body.classList.remove('playing');`);
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
