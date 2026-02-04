import Testing

@testable import Blitz3DEngine

@Test func freeEntityReparentsChildrenToParentOrRoot() {
    let g = SceneGraph()
    let parent = g.createEntity(type: .pivot, parent: nil)
    let child1 = g.createEntity(type: .pivot, parent: parent)
    let child2 = g.createEntity(type: .pivot, parent: parent)

    #expect(parent.children.count == 2)
    #expect(child1.parent === parent)
    #expect(child2.parent === parent)

    g.freeEntity(id: parent.id)

    // Parent removed from graph.
    #expect(g.getEntity(parent.id) == nil)

    // Children should now be under root.
    #expect(child1.parent === g.root)
    #expect(child2.parent === g.root)
    #expect(g.root.children.contains(where: { $0 === child1 }))
    #expect(g.root.children.contains(where: { $0 === child2 }))
}

@Test func freeEntityRemovesFromParentChildrenList() {
    let g = SceneGraph()
    let parent = g.createEntity(type: .pivot, parent: nil)
    let child = g.createEntity(type: .pivot, parent: parent)
    #expect(parent.children.contains(where: { $0 === child }))

    g.freeEntity(id: child.id)

    #expect(g.getEntity(child.id) == nil)
    #expect(parent.children.contains(where: { $0 === child }) == false)
}

