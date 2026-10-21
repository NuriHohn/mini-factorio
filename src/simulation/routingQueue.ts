interface RoutingPriority { estimate: number; order: number }
function before<T extends RoutingPriority>(a: T, b: T) { return a.estimate < b.estimate || (a.estimate === b.estimate && a.order < b.order) }
export function pushRoute<T extends RoutingPriority>(heap: T[], node: T) {
  heap.push(node)
  let i = heap.length - 1
  while (i > 0) {
    const parent = (i - 1) >> 1
    if (!before(node, heap[parent])) break
    heap[i] = heap[parent]; i = parent
  }
  heap[i] = node
}
export function popRoute<T extends RoutingPriority>(heap: T[]): T {
  const first = heap[0], last = heap.pop()!
  if (heap.length) {
    let i = 0
    while (i * 2 + 1 < heap.length) {
      let child = i * 2 + 1
      if (child + 1 < heap.length && before(heap[child + 1], heap[child])) child++
      if (!before(heap[child], last)) break
      heap[i] = heap[child]; i = child
    }
    heap[i] = last
  }
  return first
}
