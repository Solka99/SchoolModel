// Local Chrome QA using its DevTools protocol; no browser-test dependency.
// Start Vite first, then: node scripts/browser-smoke.mjs [URL]
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const url = process.argv[2] || 'http://127.0.0.1:5173/';
const rushOnly = process.argv.includes('--rush-only');
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
    return new Promise((resolve, reject) => {
      const id = ++next;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`DevTools timed out: ${method}`)); }, 60000);
      pending.set(id, { resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); } });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }
  socket.addEventListener('close', () => { for (const task of pending.values()) task.reject(new Error('Test browser disconnected')); pending.clear(); });
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
    async function key(key,code,virtualKey,modifiers=0,text) {
      await call('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:virtualKey,modifiers,...(text?{text}: {})});
      await call('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:virtualKey});
    }
    if (!rushOnly) {
    const counts = await evaluate(`({chairs:schoolRush.world.objects.filter(o=>o.kind==='chair').length,desks:schoolRush.world.objects.filter(o=>o.kind==='desk').length,assets:schoolRush.models.templates.size,batches:schoolRush.world.school.batchedFurnitureMeshes,drawCalls:schoolRush.renderer.info.render.calls})`);
    assert.deepEqual({ chairs: counts.chairs, desks: counts.desks, assets: counts.assets }, { chairs: 1696, desks: 1680, assets: 5 });
    assert.ok(counts.batches >= counts.chairs + counts.desks, 'Student furniture is rendered in instanced batches');
    const renderStats = await evaluate(`(()=>{let pointLights=0;schoolRush.world.scene.traverse(o=>{if(o.isPointLight)pointLights++});return {batches:schoolRush.world.school.instanceMeshes.length,batchedBoxes:schoolRush.world.school.batchedBoxMeshes,pointLights}})()`);
    console.log('Initial scene render stats:', JSON.stringify(renderStats), `${counts.batches} furniture meshes`, `${counts.drawCalls} draw calls`);
    assert.ok(renderStats.batchedBoxes > 500, 'School structure is rendered in instanced batches');
    assert.ok(renderStats.batches < 60, 'Static batches should be grouped by corridor instead of the entire school or every classroom');
    assert.ok(renderStats.pointLights <= 20, 'Room and corridor lighting should stay within the light budget');
    assert.ok(counts.drawCalls < 200, `School scene still has too many draw calls: ${counts.drawCalls}`);
    // A real mouse click tests the user-gesture boundary for Pointer Lock.
    const button = await evaluate(`(()=>{const r=document.querySelector('#start-button').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    await call('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...button });
    await call('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...button });
    await delay(300);
    const locked = await evaluate('!!document.pointerLockElement');
    assert.equal(locked, true, 'User click acquires Pointer Lock');
    const startX = await evaluate('schoolRush.player.feet.x');
    await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'w', code: 'KeyW' });
    for(let i=0;i<50;i++) {
      if((await evaluate('schoolRush.player.feet.x')) > startX + 0.1) break;
      await delay(100);
    }
    const movementState = await evaluate(`({running:schoolRush.running,locked:!!document.pointerLockElement,keys:[...schoolRush.input.keys],feet:schoolRush.player.feet.toArray(),visible:!document.hidden})`);
    await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'w', code: 'KeyW' });
    assert.ok((await evaluate('schoolRush.player.feet.x')) > startX + 0.1, 'Captured keyboard moves the player: '+JSON.stringify(movementState));
    const activeDrawCalls = await evaluate('schoolRush.renderer.info.render.calls');
    console.log('Pointer Lock and keyboard movement: passed; active draw calls:', activeDrawCalls);
    await evaluate(`schoolRush.pause(); document.querySelector('#welcome').hidden=true; schoolRush.view.sync(schoolRush.player.feet);`);
    await delay(100); await screenshot('classroom');
    const checks = await evaluate(`(async()=>{
      const g=schoolRush,{Vector3,Box3,WebGLRenderTarget}=await import('/node_modules/.vite/deps/three.js');
      const assert=(condition,message)=>{if(!condition)throw new Error(message)};
      const F=new Vector3(0,0,1),R=new Vector3(1,0,0),school=g.world.school;
      const transform=(origin,yaw,x,z)=>[origin[0]+Math.cos(yaw)*x+Math.sin(yaw)*z,origin[2]-Math.sin(yaw)*x+Math.cos(yaw)*z];
      const segmentPoint=(corridor,x,z)=>transform(corridor.center,corridor.yaw,x,z);
      const roomPoint=(room,x,z)=>transform(room.origin,room.yaw,x,z);
      function aim(object,point){
        g.view.camera.position.copy(g.player.feet).y+=1.62;object.root.updateWorldMatrix(true,true);
        g.view.camera.lookAt(point||new Box3().setFromObject(object.root).getCenter(new Vector3()));g.view.camera.updateMatrixWorld();
        g.interactions.update();assert(g.interactions.target===object,'Aim at '+object.label+'; got '+g.interactions.target?.label);
      }
      function move(x,z){
        for(let i=0;i<3500;i++){
          const dx=x-g.player.feet.x,dz=z-g.player.feet.z,d=Math.hypot(dx,dz);
          if(d<0.045){for(let j=0;j<20;j++)g.player.update(1/120,{x:0,z:0},F,R,false,g.world.colliders);return;}
          g.player.update(1/120,{x:dx/d,z:dz/d},F,R,false,g.world.colliders);
        }
        const wanted=new Box3(new Vector3(x-0.2,0,z-0.2),new Vector3(x+0.2,1.8,z+0.2));
        throw new Error('Walk blocked: '+JSON.stringify({target:[x,z],feet:g.player.feet.toArray(),
          blockers:g.world.colliders.filter(c=>c.box.intersectsBox(wanted)).map(c=>({name:c.owner.root.name,box:[c.box.min.toArray(),c.box.max.toArray()]})),
          nearby:g.world.colliders.filter(c=>c.box.min.y<1.8&&c.box.max.y>0&&Math.hypot(Math.max(c.box.min.x-g.player.feet.x,0,g.player.feet.x-c.box.max.x),Math.max(c.box.min.z-g.player.feet.z,0,g.player.feet.z-c.box.max.z))<1.2).map(c=>({name:c.owner.root.name,box:[c.box.min.toArray(),c.box.max.toArray()]}))}));
      }
      function open(door){
        g.view.camera.position.copy(g.player.feet).y+=1.62;g.view.camera.lookAt(door.panelCollider.box.getCenter(new Vector3()));g.view.camera.updateMatrixWorld();
        assert(g.interactions.findTarget(g.view.camera,g.world.pickables)===door,'Reachable door ray target');
        g.interactions.activate();for(let i=0;i<120;i++)g.world.update(1/120,g.player.box);
        assert(door.angle===95,'Door opens without hitting player');
      }
      assert(school.corridors.length===4&&school.rooms.length===16,'Four corridors and sixteen classrooms');
      assert(!school.obstacles&&!school.gates.length,'Exploration has no challenge obstacles or gates');
      for(let i=0;i<4;i++){
        const end=segmentPoint(school.layout.corridors[i],0,school.layout.length/2);
        const start=segmentPoint(school.layout.corridors[(i+1)%4],0,-school.layout.length/2);
        assert(Math.hypot(end[0]-start[0],end[1]-start[1])<1e-5,'Corridor loop joins at section '+i);
      }
      g.respawn();
      const first=school.corridor,sp=segmentPoint(school.layout.corridors[0],school.params.corridorWidth/2-0.9,-school.layout.length/2+2.2);
      move(...sp);aim(first.lightSwitch);
      assert(g.interactions.highlight.helper.visible,'Switch target is highlighted');
      assert(g.interactions.activate()&&!first.lighting.on,'Corridor light switch works');
      assert(school.rooms.every(r=>r.classroom.lighting.on),'Room lights are independent');
      g.interactions.activate();assert(first.lighting.on,'Corridor lights turn back on');
      const visited=[];
      for(let i=0;i<4;i++){
        const room=school.rooms[i],c=room.classroom,doorZ=school.layout.metrics.doorCenterZ;
        if(i>0){
          const previousRoom=school.rooms[i-1];
          if(previousRoom.corridorIndex!==room.corridorIndex){
            const previous=school.layout.corridors[previousRoom.corridorIndex],next=school.layout.corridors[room.corridorIndex];
            move(...segmentPoint(previous,0,school.layout.length/2-0.8));
            move(...segmentPoint(next,0,-school.layout.length/2+0.8));
          }
        }
        const outside=roomPoint(room,-room.side*(c.metrics.roomWidth/2+1.3),doorZ);
        move(...outside);open(c.door);
        const inside=roomPoint(room,-room.side*(c.metrics.roomWidth/2-0.8),doorZ);
        move(...inside);
        assert(school.locationAt(g.player.feet).includes(room.number),'Enter room '+room.number);
        const on=c.lighting.lights.reduce((n,l)=>n+l.intensity,0);
        c.lightSwitch.interact();assert(!c.lighting.on,'Room light circuit toggles off');
        assert(school.rooms.filter(r=>r!==room).every(r=>r.classroom.lighting.on),'Other room circuits remain on');
        c.lightSwitch.interact();assert(c.lighting.on&&on>0,'Room lights restore');
        const boardPoint=roomPoint(room,0,c.metrics.zFront+0.2);
        g.view.camera.position.set(boardPoint[0],1.62,boardPoint[1]+(room.yaw===Math.PI/2?1:-1));
        g.view.camera.lookAt(boardPoint[0],1.6,boardPoint[1]);g.view.camera.updateMatrixWorld();
        assert(g.interactions.edit(c.blackboard),'Board editor opens in room '+room.number);
        g.editor.input.value='Room '+room.number;g.editor.sync();g.editor.close();assert(c.blackboard.text==='Room '+room.number,'Board state saved');
        visited.push(room.number);
        const corridorPoint=segmentPoint(school.layout.corridors[room.corridorIndex],0,school.layout.rooms[i].localOrigin[2]+doorZ);
        move(...corridorPoint);
      }
      assert(new Set(school.rooms.slice(0,4).map(r=>r.classroom.blackboard.text)).size===4,'Boards have independent state');
      g.rebuild({seatRows:4,seatCols:3,corridorWidth:3,frontMargin:1.5,roomHeight:3.2});
      assert(g.world.objects.filter(o=>o.kind==='desk').length===576,'Rebuild counts');
      assert(g.world.school.corridors.length===4&&g.world.school.rooms.every(r=>r.classroom.lighting.on),'Rebuild preserves the square layout');
      assert(!g.interactions.editing&&!g.interactions.seated,'Rebuild clears interaction state');
      g.rebuild();g.respawn();g.previewCamera();g.renderer.render(g.world.scene,g.view.camera);
      const before={...g.renderer.info.memory};
      for(let i=0;i<3;i++){g.setDebug(i%2===0);g.rebuild();g.setDebug(false);g.previewCamera();g.renderer.render(g.world.scene,g.view.camera);}
      const after={...g.renderer.info.memory};
      assert(after.geometries===before.geometries&&after.textures===before.textures,'Rebuild resources grow: '+JSON.stringify({before,after}));
      return {visited,objects:g.world.objects.length,colliders:g.world.colliders.length,memory:after,checks:'passed'};
    })()`);
    console.log('School traversal checks:', JSON.stringify(checks));
    const editorFeet = await evaluate(`(()=>{const g=schoolRush;g.player.feet.copy(g.world.school.spawn);g.interactions.edit(g.world.school.rooms[0].classroom.blackboard);g.editor.input.value='';g.editor.sync();return g.player.feet.toArray()})()`);
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
    await evaluate(`document.querySelector('#welcome').hidden=true; const p=schoolRush.world.school.spawn;schoolRush.view.camera.position.set(p[0],1.62,p[2]);schoolRush.view.camera.lookAt(p[0]+8,1.62,p[2]);`);
    await delay(150); await screenshot('corridor');
    await evaluate(`const r=schoolRush.world.school.rooms[0],z=r.classroom.metrics.zBack-0.7;schoolRush.view.camera.position.set(r.origin[0]+Math.sin(r.yaw)*z,2.7,r.origin[2]+Math.cos(r.yaw)*z);schoolRush.view.camera.lookAt(r.origin[0],1,r.origin[2]);`);
    await delay(150); await screenshot('classroom-interior');
    await evaluate(`schoolRush.world.school.rooms[0].classroom.lightSwitch.interact();`);
    await delay(150); await screenshot('lights-off');
    await evaluate(`schoolRush.world.school.rooms[0].classroom.lightSwitch.interact();`);
    await delay(150); await screenshot('lights-on');
    await evaluate(`(()=>{const g=schoolRush,r=g.world.school.rooms[0],s=r.classroom.lightSwitch,p=s.root.getWorldPosition(s.root.position.clone());g.player.reset(p.clone().setY(0).add({x:Math.cos(r.yaw),y:0,z:-Math.sin(r.yaw)}));g.view.sync(g.player.feet);g.view.camera.lookAt(p);g.view.camera.updateMatrixWorld();g.interactions.update();document.body.classList.add('playing')})()`);
    await screenshot('interaction-target');
    await evaluate(`schoolRush.interactions.clearTarget();schoolRush.hud.setPrompt('');document.body.classList.remove('playing');`);
    await evaluate(`document.querySelector('#welcome').hidden=false; schoolRush.parameters.open();`);
    await screenshot('settings');
    await evaluate(`schoolRush.parameters.dialog.close();`);
    }
    const { checkRush } = await import('./check-rush.mjs');
    await checkRush({ call, evaluate, screenshot, delay, key });
  }
  await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
  await evaluate(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
  assert.equal(await evaluate('innerWidth'),390,'Narrow-screen viewport applied');
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
