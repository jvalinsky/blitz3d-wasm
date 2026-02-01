import XCTest

@testable import Blitz3DEngine

final class SceneGraphTests: XCTestCase {
    var sceneGraph: SceneGraph!

    override func setUp() {
        super.setUp()
        sceneGraph = SceneGraph()
    }

    override func tearDown() {
        sceneGraph = nil
        super.tearDown()
    }

    func testCreateEntity() {
        let entity = sceneGraph.createEntity(type: .pivot, parent: nil)
        XCTAssertNotNil(entity)
        XCTAssertEqual(entity.type, .pivot)
        // Root is parent if nil passed
        XCTAssertEqual(entity.parent, sceneGraph.root)
    }

    func testParenting() {
        let parent = sceneGraph.createEntity(type: .pivot, parent: nil)
        let child = sceneGraph.createEntity(type: .pivot, parent: parent)

        XCTAssertEqual(child.parent, parent)
        XCTAssertTrue(parent.children.contains { $0 === child })
    }

    func testHierarchyClean() {
        // Test that removing a parent removes children
        // (This behavior depends on implementation, usually in engines destroying parent destroys children)
        // For now just test basic tree structure validity
        let root = sceneGraph.createEntity(type: .pivot, parent: nil)
        let child1 = sceneGraph.createEntity(type: .pivot, parent: root)
        let child2 = sceneGraph.createEntity(type: .pivot, parent: root)

        XCTAssertEqual(root.children.count, 2)
        XCTAssertEqual(child1.parent, root)
        XCTAssertEqual(child2.parent, root)
    }

    func testTransform() {
        let entity = sceneGraph.createEntity(type: .pivot, parent: nil)
        entity.localPosition = Vec3(x: 1, y: 2, z: 3)
        // Check local transform update? Or just property
        XCTAssertEqual(entity.localPosition.x, 1)
        XCTAssertEqual(entity.localPosition.y, 2)
        XCTAssertEqual(entity.localPosition.z, 3)
    }

    func testTransformHierarchy() {
        let root = sceneGraph.createEntity(type: .pivot, parent: nil)
        let child = sceneGraph.createEntity(type: .pivot, parent: root)

        // Move root to (10, 0, 0)
        root.localPosition = Vec3(x: 10, y: 0, z: 0)

        // Move child to (0, 5, 0) relative to root
        child.localPosition = Vec3(x: 0, y: 5, z: 0)

        // Update transforms (usually done by engine loop)
        sceneGraph.updateTransforms()

        // Check global positions
        let rootPos = sceneGraph.entityPosition(root.id, global: true)
        let childPos = sceneGraph.entityPosition(child.id, global: true)

        XCTAssertEqual(rootPos.x, 10, accuracy: 0.001)
        XCTAssertEqual(rootPos.y, 0, accuracy: 0.001)
        XCTAssertEqual(rootPos.z, 0, accuracy: 0.001)

        // Child world pos should be (10, 5, 0)
        XCTAssertEqual(childPos.x, 10, accuracy: 0.001)
        XCTAssertEqual(childPos.y, 5, accuracy: 0.001)
        XCTAssertEqual(childPos.z, 0, accuracy: 0.001)
    }

    func testRotationHierarchy() {
        let root = sceneGraph.createEntity(type: .pivot, parent: nil)
        let child = sceneGraph.createEntity(type: .pivot, parent: root)

        // Place child at (0, 0, 10)
        child.localPosition = Vec3(x: 0, y: 0, z: 10)

        // Rotate root by 90 degrees around Y axis
        // We need to know the rotation direction.
        // Assuming Y-up.
        root.localRotation = Vec3(x: 0, y: 90, z: 0)

        sceneGraph.updateTransforms()

        let childPos = sceneGraph.entityPosition(child.id, global: true)

        // If CCW rotation around Y:
        // x' = x cos - z sin = 0 - 10 * 1 = -10 (or 10 if CW/Left-handed)
        // Let's assert non-zero x and zero z first to confirm rotation happened

        XCTAssertNotEqual(childPos.x, 0, accuracy: 0.001)
        XCTAssertEqual(childPos.z, 0, accuracy: 0.001)
        XCTAssertEqual(childPos.y, 0, accuracy: 0.001)
    }

    func testCollectRenderables() {
        let root = sceneGraph.createEntity(type: .pivot, parent: nil)

        let mesh1 = sceneGraph.createEntity(type: .mesh, parent: root)
        let sprite1 = sceneGraph.createEntity(type: .sprite, parent: root)
        let camera = sceneGraph.createEntity(type: .camera, parent: root)  // Should skip
        let hiddenMesh = sceneGraph.createEntity(type: .mesh, parent: root)

        // Check filtering
        sceneGraph.setEntityVisibility(hiddenMesh.id, visible: false)

        let renderables = sceneGraph.collectRenderables()

        // Should contain mesh1 and sprite1. Hidden mesh and camera should be excluded.
        XCTAssertEqual(renderables.count, 2)
        XCTAssertTrue(renderables.contains(mesh1))
        XCTAssertTrue(renderables.contains(sprite1))
        XCTAssertFalse(renderables.contains(hiddenMesh))
        XCTAssertFalse(renderables.contains(camera))
    }
}
