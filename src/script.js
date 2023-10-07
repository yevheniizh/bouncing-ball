import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import * as dat from 'lil-gui'
import * as CANNON from 'cannon-es'

THREE.ColorManagement.enabled = false

/**
 * State
 */
const state = {
    width: window.innerWidth,
    height: window.innerHeight,
    stareWidth: 10,
    stareHeight: 2.5,
    objects: [],
}

/**
 * Debug
 */
const debug = {
    gui: null,
    init: () => {
        debug.gui = new dat.GUI()
        debug.gui.add(debug, 'reset')
    },
    reset: () => {
        debug.gui.destroy();
        for(const object of state.objects) {
            world.removeBody(object.body)
            scene.remove(object.mesh)
        }
        
        state.objects.splice(0, state.objects.length)

        debug.init();
        debug.onReset(); // define at the end
    },
}
debug.init();

/**
 * Canvas
 */
const canvas = document.querySelector('canvas.webgl')

/**
 * Scene
 */
const scene = new THREE.Scene()

/**
 * Lights
 */
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7)
scene.add(ambientLight)

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.2)
directionalLight.castShadow = true
directionalLight.shadow.mapSize.set(1024, 1024)
directionalLight.shadow.camera.far = 15
directionalLight.shadow.camera.left = - 7
directionalLight.shadow.camera.top = 7
directionalLight.shadow.camera.right = 7
directionalLight.shadow.camera.bottom = - 7
directionalLight.position.set(5, 5, 5)
scene.add(directionalLight)

window.addEventListener('resize', () => {
    // Update state
    state.width = window.innerWidth
    state.height = window.innerHeight

    // Update camera
    camera.aspect = state.width / state.height
    camera.updateProjectionMatrix()

    // Update renderer
    renderer.setSize(state.width, state.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})

/**
 * Camera
 */
const camera = new THREE.PerspectiveCamera(75, state.width / state.height, 0.1, 100)
camera.position.set(-25, 5, 15)
scene.add(camera)

/**
 * Controls
 */
const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({ canvas })
renderer.outputColorSpace = THREE.LinearSRGBColorSpace
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.setSize(state.width, state.height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

/* ******************************************************* */

/**
 * Physics
 */
const world = new CANNON.World()
world.broadphase = new CANNON.SAPBroadphase(world)
world.allowSleep = true
world.gravity.set(0, -9.82, 0)

// Default material
const defaultMaterial = new CANNON.Material('default')
const defaultContactMaterial = new CANNON.ContactMaterial(
    defaultMaterial,
    defaultMaterial,
    {
        friction: 0.75,
        restitution: 0.75
    }
)
world.defaultContactMaterial = defaultContactMaterial

/**
 * Sphere
 */
const createSphere = (radius, position) => {
    // Three.js mesh
    const sphereGeometry = new THREE.SphereGeometry(radius, 20, 20)
    const sphereMaterial = new THREE.MeshStandardMaterial({
        metalness: 0.3,
        roughness: 0.4,
    })
    const mesh = new THREE.Mesh(sphereGeometry, sphereMaterial)
    mesh.castShadow = true
    mesh.position.copy(position)
    scene.add(mesh)

    // Cannon.js body
    const body = new CANNON.Body({
        mass: 1.1,
        shape: new CANNON.Sphere(radius),
        material: defaultMaterial
    })
    body.position.copy(position)
    world.addBody(body)

    // Register both
    state.objects.push({ mesh, body })

    return { mesh, body }
}

const initSphere = () => {
    const sphere = createSphere( 1, { x: 0, y: 5, z: -state.stareHeight * 0.75 } );
    sphere.body.applyLocalForce(new CANNON.Vec3(0, 0, 150), new CANNON.Vec3(0, 0, 0))
    debug.gui.add(sphere.body, 'mass').min(0.5).max(5).step(0.001).name('Sphere mass')
}

initSphere();

/**
 * Stairs
 */
const createStair = ({width, height, position}) => {
    // Three.js mesh
    const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(width, height),
        new THREE.MeshStandardMaterial({
            color: '#777777',
            metalness: 0.3,
            roughness: 0.4,
        })
    )
    floor.receiveShadow = true
    floor.rotation.x = - Math.PI * 0.5
    floor.position.copy(position)
    scene.add(floor)

    // Cannon.js body
    const floorBody = new CANNON.Body({
        shape: new CANNON.Box(new CANNON.Vec3(width * 0.5, height * 0.5, 0.1)),
        type: CANNON.Body.STATIC,
    })
    floorBody.position.copy(position)
    world.addBody(floorBody)
    floorBody.quaternion.setFromAxisAngle(new CANNON.Vec3(- 1, 0, 0), Math.PI * 0.5) 
}

for(let i = 0; i < 5; i++) {
    createStair({width: state.stareWidth, height: state.stareHeight, position: { x: 0, y: -state.stareHeight * i, z: state.stareHeight * i}})
}

/* ******************************************************* */

debug.onReset = () => initSphere();

/**
 * Animate
 */
const clock = new THREE.Clock()
let oldElapsedTime = 0

const tick = () => {
    const elapsedTime = clock.getElapsedTime()
    const deltaTime = elapsedTime - oldElapsedTime
    oldElapsedTime = elapsedTime

    // Update physics
    world.step(1 / 60, deltaTime, 3)
    
    for(const object of state.objects) {
        object.mesh.position.copy(object.body.position)
        object.mesh.quaternion.copy(object.body.quaternion)
    }

    // Update controls
    controls.update()

    // Render
    renderer.render(scene, camera)

    // Call tick again on the next frame
    window.requestAnimationFrame(tick)
}

tick()