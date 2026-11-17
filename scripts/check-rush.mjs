import assert from 'node:assert/strict';

export async function checkRush({ call, evaluate, screenshot, delay, key }) {
  async function click(selector) {
    const p = await evaluate(`(()=>{const r=document.querySelector('${selector}').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    await call('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...p });
    await call('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...p });
  }
  async function until(expression, message) {
    for (let i = 0; i < 60; i++) { if (await evaluate(expression)) return; await delay(100); }
    throw new Error(message);
  }
  await evaluate(`schoolRush.pause();document.querySelector('#target-room').value='103';document.querySelector('#challenge-time').value='60';`);
  await click('#rush-button');
  await until(`schoolRush.rush.state==='running'&&!!document.pointerLockElement`, 'Rush starts after actual mouse capture');
  assert.equal(await evaluate('schoolRush.rush.timer.duration'), 60, 'Selected challenge duration is used');
  await until(`schoolRush.rush.timer.remaining<59.9`, 'Active countdown advances');
  await screenshot('rush-hud');
  await evaluate('document.exitPointerLock()');
  await until(`schoolRush.rush.state==='paused'`, 'Releasing the mouse pauses the run');
  const paused = await evaluate('schoolRush.rush.timer.remaining'); await delay(350);
  assert.equal(await evaluate('schoolRush.rush.timer.remaining'), paused, 'Paused clock stays fixed');
  await evaluate('schoolRush.parameters.open()');
  assert.equal(await evaluate(`document.querySelector('#settings-dialog').open`), false, 'Cannot rebuild settings during a run');
  await screenshot('rush-paused');
  await click('#rush-button');
  await until(`schoolRush.rush.state==='running'`, 'Resume button resumes');
  assert.ok((await evaluate('schoolRush.rush.timer.remaining')) <= paused, 'Resume does not reset the timer');
  await key('r', 'KeyR', 82);
  await until(`schoolRush.rush.state==='ready'&&!document.pointerLockElement`, 'R resets to ready with mouse released');
  assert.equal(await evaluate('schoolRush.rush.timer.remaining'), 60);
  console.log('Rush start, pause, resume, and R reset: passed');

  const report = await evaluate(`(()=>{
    const g=schoolRush,Vector3=g.player.feet.constructor,step=1/120;
    const assert=(value,message)=>{if(!value)throw new Error(message)};
    function activateAt(object,position,point){
      g.player.reset(new Vector3(position[0],0,position[1]));g.view.sync(g.player.feet);
      g.view.camera.lookAt(point);g.view.camera.updateMatrixWorld();g.interactions.update();
      assert(g.interactions.target===object,'Raycast reaches '+object.label+'; got '+g.interactions.target?.label+
        ' '+JSON.stringify({included:g.world.pickables.includes(object.root),visible:object.root.visible,
          root:object.root.getWorldPosition(new Vector3()).toArray(),feet:g.player.feet.toArray(),
          same:g.interactions.target===object,targetRoot:g.interactions.target?.root?.id,objectRoot:object.root.id,
          targetKind:g.interactions.target?.kind,targetRoom:g.interactions.target?.room?.number,
          active:g.world.school.activeKey===object,
          hits:g.interactions.raycaster.intersectObjects(g.world.pickables,true).slice(0,3).map(hit=>({name:hit.object.name,distance:hit.distance,owner:hit.object.userData.owner?.kind,interactable:hit.object.userData.owner?.interactable}))}));
      assert(g.interactions.activate(),'Activate '+object.label);
    }
    function run(number){
      document.querySelector('#target-room').value=number;g.beginRush({lock:false});g.rush.start();
      const school=g.world.school,target=school.rooms.find(room=>room.number===number);
      assert(school.corridors.length===4&&school.gates.length===4,'Challenge builds four gated corridors');
      assert(school.obstacles.carts.length===12,'Three moving carts in each corridor');
      assert(!school.objects.some(object=>object.kind==='timed-passage'),'No timed passage remains');
      if(target.corridorIndex>0){
        const firstGate=school.gates[0],initialKey=school.activeKey;
        assert(initialKey.room.corridorIndex===0,'Initial key is in the corridor for the first barrier');
        const closedGatePoint=firstGate.panel.getWorldPosition(new Vector3());
        const closedGateYaw=school.layout.corridors[0].yaw;
        const beyondClosedGate=new Vector3(
          closedGatePoint.x+Math.sin(closedGateYaw)*0.1,0,
          closedGatePoint.z+Math.cos(closedGateYaw)*0.1,
        );
        assert(g.player.blocked(beyondClosedGate,g.world.colliders),'Closed corridor barrier blocks passage');
        firstGate.interact();assert(!firstGate.unlocked&&!g.rush.hasKey,'Closed barrier rejects a missing key');
        for(let index=0;index<target.corridorIndex;index++){
          const pickup=school.activeKey;
          assert(pickup&&pickup.room.corridorIndex===index&&pickup.room.corridorIndex<g.rush.reachableCorridors,
            'Key spawns in the accessible corridor whose barrier is next');
          const keyPoint=pickup.root.getWorldPosition(new Vector3());
          activateAt(pickup,[keyPoint.x,keyPoint.z-0.65],keyPoint);
          assert(g.rush.hasKey&&!school.activeKey,'Collecting a key updates the run');
          const gate=school.gates[index],gatePoint=gate.panel.getWorldPosition(new Vector3());
          const yaw=school.layout.corridors[index].yaw;
          activateAt(gate,[gatePoint.x-Math.sin(yaw)*0.8,gatePoint.z-Math.cos(yaw)*0.8],gatePoint);
          assert(gate.unlocked&&!g.rush.hasKey,'Key raises and is consumed by the next corridor barrier');
          const closedHeight=gate.collider.box.min.y;
          for(let i=0;i<120;i++)g.world.update(step,null);
          assert(gate.lift===gate.openHeight&&gate.collider.box.min.y>closedHeight,'Barrier rises clear of the route');
          if(index+1<target.corridorIndex){
            assert(school.activeKey.room.corridorIndex===index+1&&school.activeKey.room.corridorIndex<g.rush.reachableCorridors,
              'Next key is in the newly reached corridor for its barrier');
          }
        }
      }else assert(!school.activeKey,'No key is required when the target is in the starting corridor');
      if(number==='103'){
        g.player.reset(new Vector3(...school.rooms[0].origin));g.advanceRace(step);
        assert(g.rush.state==='running','Wrong classroom does not win');
      }
      g.player.reset(new Vector3(...target.origin));g.advanceRace(step);
      assert(g.rush.state==='won','Reach selected classroom '+number);
      return {number,remaining:g.rush.timer.remaining,keysUsed:target.corridorIndex,carts:school.obstacles.carts.length};
    }
    g.beginRush({lock:false});g.rush.start();
    const cart=g.world.school.obstacles.carts[0],cartPoint=cart.root.getWorldPosition(new Vector3());
    g.player.reset(new Vector3(cartPoint.x,0,cartPoint.z));const overlapping=g.player.box.intersectsBox(cart.collider.box);g.step(step);
    assert(g.rush.hits===1&&g.rush.penaltySeconds===2,'Cart contact costs two seconds once '+JSON.stringify({
      overlapping,hits:g.rush.hits,state:g.rush.state,contact:cart.contact,elapsed:cart.elapsed,point:cartPoint.toArray(),
      collider:[cart.collider.box.min.toArray(),cart.collider.box.max.toArray()],
    }));
    const runs=['101','102','103','104'].map(run);
    return {runs,cartPenalty:'passed'};
  })()`);
  console.log('Key progression, destinations, and moving-cart runs:', JSON.stringify(report));
  await screenshot('rush-victory');
  await evaluate(`schoolRush.beginRush({lock:false});schoolRush.rush.start();schoolRush.advanceRace(schoolRush.rush.timer.duration+1);`);
  assert.equal(await evaluate('schoolRush.rush.state'), 'lost', 'Timeout loses');
  assert.equal(await evaluate('schoolRush.rush.timer.remaining'), 0);
  console.log('Rush timeout: passed');
  await screenshot('rush-defeat');
  await evaluate('schoolRush.beginRush({lock:false});schoolRush.rush.start();');
  assert.equal(await evaluate('schoolRush.rush.hits'), 0, 'Fresh run clears penalties');
  await evaluate('schoolRush.pause()');
  const memory = await evaluate(`(()=>{
    const g=schoolRush;g.beginRush({lock:false});g.previewCamera();g.renderer.render(g.world.scene,g.view.camera);
    const before={...g.renderer.info.memory};
    for(let i=0;i<3;i++){g.beginRush({lock:false});g.previewCamera();g.renderer.render(g.world.scene,g.view.camera);}
    const after={...g.renderer.info.memory};
    return {before,after};
  })()`);
  assert.deepEqual(memory.after, memory.before, 'Restart resource counts stay stable');
  console.log('Rush restart resources:', JSON.stringify(memory.after));
  await evaluate(`document.querySelector('#welcome').hidden=true;document.body.classList.add('playing');`);
  await screenshot('rush-obstacles');
  await evaluate(`document.querySelector('#welcome').hidden=false;document.body.classList.remove('playing');`);
  await click('#start-button');
  await until(`schoolRush.rush.state==='idle'&&!schoolRush.world.school.obstacles`, 'Leave run returns to obstacle-free exploration');
  await evaluate('schoolRush.pause()');
}
