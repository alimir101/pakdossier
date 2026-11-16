/**
 * Keyed JSON providers. Each one is a thin, dumb mapper: build URL, parse,
 * map fields, tag what the `carrier` field really means.
 *
 * Quotas are the published free tiers — the pool uses them to stop *before*
 * hitting a hard limit.
 */
import type { Adapter, ProviderFields } from './contract.ts';
import { AdapterError, getJson, num, str } from './contract.ts';

function requireKey(key: string | undefined, id: string): string {
  if (!key) throw new AdapterError('no-key', `${id}: key set nahi hai`);
  return key;
}

export const numlookupapi: Adapter = {
  id: 'numlookupapi',
  needsKey: true,
  carrierKind: 'prefix',
  confidence: 'medium',
  quotaPerMonth: 250,
  async run(input, ctx) {
    const key = requireKey(ctx.key, 'numlookupapi');
    const data = (await getJson(ctx, `https://api.numlookupapi.com/v1/validate/${input.e164}?apikey=${key}`)) as Record<string, unknown>;
    const fields: ProviderFields = {
      valid: data.valid === true,
      note: 'Carrier prefix-based hai. Free tier: 250/mah.',
    };
    const carrier = str(data.carrier);
    const line = str(data.line_type);
    const location = str(data.location);
    if (carrier) fields.carrier = carrier;
    if (line) fields.lineType = line;
    if (location) fields.location = location;
    return fields;
  },
};

export const veriphone: Adapter = {
  id: 'veriphone',
  needsKey: true,
  carrierKind: 'prefix',
  confidence: 'medium',
  quotaPerMonth: 1000,
  async run(input, ctx) {
    const key = requireKey(ctx.key, 'veriphone');
    const data = (await getJson(ctx, `https://api.veriphone.io/v2/verify?phone=${input.e164}&key=${key}`)) as Record<string, unknown>;
    if (str(data.status) === 'error') throw new AdapterError('http', `veriphone: ${str(data.message) ?? 'error'}`);
    const fields: ProviderFields = {
      valid: data.phone_valid === true,
      active: typeof data.phone_valid === 'boolean' ? data.phone_valid : undefined,
      note: 'verify endpoint ka carrier cached/prefix-based hai.',
    };
    const carrier = str(data.carrier);
    const type = str(data.phone_type);
    const region = str(data.phone_region) ?? str(data.country);
    if (carrier) fields.carrier = carrier;
    if (type) fields.lineType = type;
    if (region) fields.location = region;
    return fields;
  },
};

export const ipqs: Adapter = {
  id: 'ipqs',
  needsKey: true,
  carrierKind: 'live',
  confidence: 'medium',
  quotaPerMonth: 1000,
  async run(input, ctx) {
    const key = requireKey(ctx.key, 'ipqs');
    const data = (await getJson(ctx, `https://www.ipqualityscore.com/api/json/phone/${key}/${input.e164}`)) as Record<string, unknown>;
    if (data.success === false) throw new AdapterError('http', `ipqs: ${str(data.message) ?? 'not success'}`);
    const fields: ProviderFields = {
      valid: data.valid === true,
      active: typeof data.active === 'boolean' ? data.active : undefined,
      note: 'HLR-ish — ye live-ish carrier deta hai, prefix nahi.',
    };
    const carrier = str(data.carrier);
    const line = str(data.line_type);
    const city = str(data.city) ?? str(data.region);
    if (carrier) fields.carrier = carrier;
    if (line) fields.lineType = line;
    if (city) fields.location = city;
    const risk = num(data.fraud_score);
    if (risk !== undefined) fields.extra = { fraudScore: risk };
    return fields;
  },
};

export const abstractapi: Adapter = {
  id: 'abstractapi',
  needsKey: true,
  carrierKind: 'prefix',
  confidence: 'low',
  quotaPerMonth: 250,
  async run(input, ctx) {
    const key = requireKey(ctx.key, 'abstractapi');
    const data = (await getJson(ctx, `https://phonevalidation.abstractapi.com/v1/?api_key=${key}&phone=${input.e164}`)) as Record<string, unknown>;
    const fields: ProviderFields = { valid: data.valid === true, note: 'Carrier prefix-based. Free tier: 250/mah.' };
    const carrier = str(data.carrier);
    const type = str(data.type);
    const location = str(data.location);
    if (carrier) fields.carrier = carrier;
    if (type) fields.lineType = type;
    if (location) fields.location = location;
    return fields;
  },
};

export const numverify: Adapter = {
  id: 'numverify',
  needsKey: true,
  carrierKind: 'prefix',
  confidence: 'low',
  quotaPerMonth: 100,
  async run(input, ctx) {
    const key = requireKey(ctx.key, 'numverify');
    const data = (await getJson(ctx, `https://apilayer.net/api/validate?access_key=${key}&number=${input.e164}`)) as Record<string, unknown>;
    if (data.success === false) {
      const err = data.error as Record<string, unknown> | undefined;
      throw new AdapterError('http', `numverify: ${str(err?.info) ?? 'error'}`);
    }
    const fields: ProviderFields = { valid: data.valid === true, note: 'Carrier prefix-based. Free tier: 100/mah.' };
    const carrier = str(data.carrier);
    const line = str(data.line_type);
    const location = str(data.location);
    if (carrier) fields.carrier = carrier;
    if (line) fields.lineType = line;
    if (location) fields.location = location;
    return fields;
  },
};
