import Testing
@testable import Blitz3DEngine

@inline(__always)
private func expectApprox(_ a: Float, _ b: Float, accuracy: Float = 0.001) {
    #expect(abs(a - b) <= accuracy)
}

@Test func createEntity() {
    let sceneGraph = SceneGraph()
    let entity = sceneGraph.createEntity(type: .pivot, parent: nil)
    #expect(entity.type == .pivot)
    #expect(entity.parent === sceneGraph.root)
}

@Test func parenting() {
    let sceneGraph = SceneGraph()
    let parent = sceneGraph.createEntity(type: .pivot, parent: nil)
    let child = sceneGraph.createEntity(type: .pivot, parent: parent)

    #expect(child.parent === parent)
    #expect(parent.children.contains { $0 === child })
}

@Test func hierarchyClean() {
    let sceneGraph = SceneGraph()
    let root = sceneGraph.createEntity(type: .pivot, parent: nil)
    let child1 = sceneGraph.createEntity(type: .pivot, parent: root)
    let child2 = sceneGraph.createEntity(type: .pivot, parent: root)

    #expect(root.children.count == 2)
    #expect(child1.parent === root)
    #expect(child2.parent === root)
}

@Test func transform() {
    let sceneGraph = SceneGraph()
    let entity = sceneGraph.createEntity(type: .pivot, parent: nil)
    entity.localPosition = Vec3(x: 1, y: 2, z: 3)

    expectApprox(entity.localPosition.x, 1)
    expectApprox(entity.localPosition.y, 2)
    expectApprox(entity.localPosition.z, 3)
}

@Test func transformHierarchy() {
    let sceneGraph = SceneGraph()
    let root = sceneGraph.createEntity(type: .pivot, parent: nil)
    let child = sceneGraph.createEntity(type: .pivot, parent: root)

    root.localPosition = Vec3(x: 10, y: 0, z: 0)
    child.localPosition = Vec3(x: 0, y: 5, z: 0)

    sceneGraph.updateTransforms()

    let rootPos = sceneGraph.entityPosition(root.id, global: true)
    let childPos = sceneGraph.entityPosition(child.id, global: true)

    expectApprox(rootPos.x, 10)
    expectApprox(rootPos.y, 0)
    expectApprox(rootPos.z, 0)

    expectApprox(childPos.x, 10)
    expectApprox(childPos.y, 5)
    expectApprox(childPos.z, 0)
}

@Test func rotationHierarchy() {
    let sceneGraph = SceneGraph()
    let root = sceneGraph.createEntity(type: .pivot, parent: nil)
    let child = sceneGraph.createEntity(type: .pivot, parent: root)

    child.localPosition = Vec3(x: 0, y: 0, z: 10)
    root.localRotation = Vec3(x: 0, y: 90, z: 0)

    sceneGraph.updateTransforms()

    let childPos = sceneGraph.entityPosition(child.id, global: true)

    #expect(abs(childPos.x) > 0.001)
    expectApprox(childPos.z, 0)
    expectApprox(childPos.y, 0)
}

@Test func collectRenderables() {
    let sceneGraph = SceneGraph()
    let root = sceneGraph.createEntity(type: .pivot, parent: nil)

    let mesh1 = sceneGraph.createEntity(type: .mesh, parent: root)
    let sprite1 = sceneGraph.createEntity(type: .sprite, parent: root)
    let camera = sceneGraph.createEntity(type: .camera, parent: root)
    let hiddenMesh = sceneGraph.createEntity(type: .mesh, parent: root)

    sceneGraph.setEntityVisibility(hiddenMesh.id, visible: false)

    let renderables = sceneGraph.collectRenderables()

    #expect(renderables.count == 2)
    #expect(renderables.contains(mesh1))
    #expect(renderables.contains(sprite1))
    #expect(!renderables.contains(hiddenMesh))
    #expect(!renderables.contains(camera))
}
