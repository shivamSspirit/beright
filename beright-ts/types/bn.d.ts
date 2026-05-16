/**
 * Type declaration for bn.js
 * This provides basic types for the BN class used in Solana/Anchor code.
 */
declare module 'bn.js' {
  class BN {
    constructor(number: number | string | number[] | Uint8Array | Buffer | BN, base?: number | 'hex' | 'le' | 'be', endian?: 'le' | 'be');

    clone(): BN;
    toString(base?: number | 'hex', length?: number): string;
    toNumber(): number;
    toJSON(): string;
    toArray(endian?: 'le' | 'be', length?: number): number[];
    toArrayLike<T extends ArrayLike<number>>(
      ArrayType: new (size: number) => T,
      endian?: 'le' | 'be',
      length?: number
    ): T;
    toBuffer(endian?: 'le' | 'be', length?: number): Buffer;
    bitLength(): number;
    zeroBits(): number;
    byteLength(): number;
    isNeg(): boolean;
    isEven(): boolean;
    isOdd(): boolean;
    isZero(): boolean;
    cmp(b: BN): number;
    lt(b: BN): boolean;
    lte(b: BN): boolean;
    gt(b: BN): boolean;
    gte(b: BN): boolean;
    eq(b: BN): boolean;
    neg(): BN;
    abs(): BN;
    add(b: BN): BN;
    sub(b: BN): BN;
    mul(b: BN): BN;
    sqr(): BN;
    pow(b: BN): BN;
    div(b: BN): BN;
    mod(b: BN): BN;
    divmod(b: BN, mode?: 'div' | 'mod', positive?: boolean): { div: BN; mod: BN };
    divRound(b: BN): BN;
    and(b: BN): BN;
    or(b: BN): BN;
    xor(b: BN): BN;
    setn(bit: number, val: boolean): BN;
    shln(bits: number): BN;
    shrn(bits: number): BN;
    testn(bit: number): boolean;
    maskn(bits: number): BN;
    imaskn(bits: number): BN;
    bincn(bit: number): BN;
    notn(width: number): BN;
    gcd(b: BN): BN;
    egcd(b: BN): { a: BN; b: BN; gcd: BN };
    invm(b: BN): BN;
    fromTwos(width: number): BN;
    toTwos(width: number): BN;

    static min(...args: BN[]): BN;
    static max(...args: BN[]): BN;
    static isBN(b: any): b is BN;
    static red(reductionContext: string | BN): any;
    static mont(num: BN): any;
  }

  export = BN;
}
