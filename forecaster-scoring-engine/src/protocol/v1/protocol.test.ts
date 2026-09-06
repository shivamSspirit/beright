import {
  beRightNativeReceiptFixture,
  canonicalJson,
  disputedResolutionFixture,
  forecastReceiptV1Schema,
  hashCanonicalJson,
  polymarketReceiptFixture,
  resolutionReceiptV1Schema,
  resolvedCanonicalEventFixture,
  solanaNativeReceiptFixture,
  unresolvedCanonicalEventFixture,
  canonicalMarketV1Schema,
} from '.';

describe('Reputation Protocol v1', () => {
  it('validates the fixture set', () => {
    for (const receipt of [polymarketReceiptFixture, solanaNativeReceiptFixture, beRightNativeReceiptFixture]) {
      expect(forecastReceiptV1Schema.parse(receipt)).toEqual(receipt);
    }
    for (const market of [resolvedCanonicalEventFixture, unresolvedCanonicalEventFixture]) {
      expect(canonicalMarketV1Schema.parse(market)).toEqual(market);
    }
    expect(resolutionReceiptV1Schema.parse(disputedResolutionFixture)).toEqual(disputedResolutionFixture);
  });

  it('distinguishes trades from explicit forecasts', () => {
    expect(() => forecastReceiptV1Schema.parse({ ...beRightNativeReceiptFixture, entryPrice: 0.5 })).toThrow();
    expect(() => forecastReceiptV1Schema.parse({ ...polymarketReceiptFixture, entryPrice: null })).toThrow();
  });

  it('canonicalizes object property order and negative zero', () => {
    expect(canonicalJson({ z: -0, a: { d: 2, c: 1 } })).toBe('{"a":{"c":1,"d":2},"z":0}');
    expect(hashCanonicalJson({ b: 2, a: 1 })).toBe(hashCanonicalJson({ a: 1, b: 2 }));
  });

  it('has stable golden hashes across runs', () => {
    expect(hashCanonicalJson(polymarketReceiptFixture)).toBe('b82fdf632172230c7eb5ff1d9193d842b0b18663996c9b3390c6c573c3d3261d');
    expect(hashCanonicalJson(solanaNativeReceiptFixture)).toBe('eb98fb7889946a34df04df26d904bb115abec15302658a878a0d3a3b973cf21e');
    expect(hashCanonicalJson(beRightNativeReceiptFixture)).toBe('6a3acbf7f15f21e94f392d9e5cc80371342fa7508e561b1db087dbb83634a464');
    expect(hashCanonicalJson(resolvedCanonicalEventFixture)).toBe('1ab8c621fbcc7e8df6aa9c9c56f85aa951619fe6d8eeed58f3eb4c896237fbe9');
  });

  it('rejects non-canonical values', () => {
    expect(() => canonicalJson({ missing: undefined })).toThrow('Undefined value');
    expect(() => canonicalJson({ invalid: Number.NaN })).toThrow('Non-finite number');
  });
});
