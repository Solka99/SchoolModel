// The native VStack advances on Z (depth), rather than world Y.
export class Stack {
  constructor(axis, spacing = 0) { this.axis = axis; this.spacing = spacing; this.items = []; }
  add(size, factory) { this.items.push({ size, factory }); return this; }
  build(origin) {
    const cursor = [...origin];
    return this.items.flatMap(({ size, factory }) => {
      const result = factory([...cursor]); cursor[this.axis] += size[this.axis] + this.spacing;
      return result;
    });
  }
}
export class HStack extends Stack { constructor(spacing = 0) { super(0, spacing); } }
export class VStack extends Stack { constructor(spacing = 0) { super(2, spacing); } }
