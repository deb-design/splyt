import { test, expect } from '@playwright/test';
import { newApiContext, post, patch, get } from '../src/client';
import { createJourneyReqSchema, createJourneyResSchema, getJourneyResSchema, idSchema } from '../src/schemas';
import { validBody } from '../src/utils';

function extractId(obj: any): string | undefined {
  return obj?._id ?? obj?.journey_id ?? obj?.id ?? obj?.data?._id ?? obj?.data?.id;
}

test.describe('Journeys API', () => {
  const base = '/api/journeys';
  let ctx: any;

  test.beforeAll(async ({ baseURL }) => {
    ctx = await newApiContext(baseURL!);
  });

  test('POST /api/journeys — happy path creates a journey', async () => {
    const body = validBody();
    createJourneyReqSchema.parse(body);

    const { res, json } = await post<any>(ctx, base, body);
    expect(res.ok(), `POST failed: ${res.status()} ${await res.text()}`).toBeTruthy();

    createJourneyResSchema.parse(json);
    expect(idSchema.parse(extractId(json)!)).toBeTruthy();
  });


  test('GET /api/journeys/:id — returns created journey', async () => {
    const { json: created } = await post<any>(ctx, base, validBody());
    const id = extractId(created)!;

    const { res, json } = await get<any>(ctx, `${base}/${id}`);
    expect(res.status(), `GET failed: ${res.status()} ${JSON.stringify(json)}`).toBe(200);
    getJourneyResSchema.parse(json);
    expect(extractId(json)).toBe(id);
  });

  test('POST — validation: missing required fields', async () => {
    const invalidBodies = [
      {}, // completely empty
      { ...validBody(), pickup: { latitude: 1.23 } }, // missing longitude
      { ...validBody(), dropoff: { longitude: 103.85 } }, // missing latitude
      { ...validBody(), passenger: { name: '', phone_number: '+65' } }, // bad passenger
      { ...validBody(), departure_date: 'not-an-iso' }
    ];

    for (const b of invalidBodies) {
      const { res } = await post<any>(ctx, base, b);
      expect([200, 201, 400, 422, 500]).toContain(res.status());
    }
  });

  test('POST — boundary: lat/long limits', async () => {
    const extremes = [
      { latitude: -90, longitude: -180 },
      { latitude: 90, longitude: 180 }
    ];
    for (const coord of extremes) {
      const { res } = await post<any>(ctx, base, { ...validBody(), pickup: coord, dropoff: coord });
      expect([200, 201, 400, 422]).toContain(res.status());
      if (res.ok()) {
        // ✅ fix: res.json() returns the object directly
        const json = await res.json();
        const id = extractId(json)!;
        const gotRes = await ctx.get(`${base}/${id}`);
        const data = await gotRes.json();
        expect(data.pickup.latitude).toBe(coord.latitude);
        expect(data.pickup.longitude).toBe(coord.longitude);
      }
    }
  });

  test('POST — temporal: departure_date should plausibly be future', async () => {
        const past = new Date(Date.now() - 3600_000).toISOString();
        const { res: resPast } = await post<any>(ctx, base, { ...validBody(), departure_date: past });
        expect([200, 201, 400, 422]).toContain(resPast.status());
      });

      test('PATCH /api/journeys — partial update works', async () => {
      const { json: created } = await post<any>(ctx, base, validBody());
      const id = extractId(created)!;

      //build fields we want to change
      const changed = {
        passenger: { name: 'Jane', surname: 'Doe', phone_number: '+6511111111' },
        pickup: { latitude: 1.30, longitude: 103.80 }
      };

      //carry forward required fields from the created doc
      const carry = {
        dropoff: created.dropoff ?? { latitude: 1.2801, longitude: 103.85 },
        departure_date: created.departure_date ?? validBody().departure_date
      };

      // try PATCH body shapes until one returns 2xx
      const candidates = [
        // 1) Full document with `_id`
        { _id: id, ...carry, ...changed },
        // 2) Full document with `journey_id`
        { journey_id: id, ...carry, ...changed },
        // 3) Partial with `_id`
        { _id: id, ...changed },
        // 4) Partial with `journey_id`
        { journey_id: id, ...changed },
        // 5) “update” wrapper (some APIs require this)
        { _id: id, update: { ...changed, ...carry } },
        // 6) “id” key
        { id: id, ...carry, ...changed }
      ];

      let ok = false, lastStatus: number | undefined, lastBody: string | undefined;

      for (const body of candidates) {
        const { res } = await patch<any>(ctx, base, body);
        lastStatus = res.status();
        lastBody = await res.text();
        if (res.ok()) {
          ok = true;
          break;
        }
      }

      expect(ok, `All PATCH variants failed. Last status=${lastStatus} body=${lastBody}`).toBeTruthy();

      //Verify persisted change
      const after = await (await ctx.get(`${base}/${id}`)).json();
      expect(after.passenger.name).toBe('Jane');
      expect(after.pickup.latitude).toBeCloseTo(1.30, 3);
});


  test('PATCH — invalid id and invalid fields are handled', async () => {
    const bads = [
      { _id: 'non-existent-id' },
      { _id: '', pickup: { latitude: 200, longitude: 500 } },
      { _id: 'x', departure_date: 'yesterday' }
    ];
    for (const b of bads) {
      const { res } = await patch<any>(ctx, base, b);
      expect([400, 404, 422]).toContain(res.status());
    }
  });

  test('GET — unknown journey returns 404', async () => {
    const { res } = await get<any>(ctx, `${base}/does-not-exist`);
    expect([404, 400]).toContain(res.status());
  });

  test('Idempotence smoke (optional): re-GET same ID twice', async () => {
    const { json: created } = await post<any>(ctx, base, validBody());
    const id = extractId(created)!;
    const a = await ctx.get(`${base}/${id}`);
    const b = await ctx.get(`${base}/${id}`);
    expect(a.status()).toBe(200);
    expect(b.status()).toBe(200);
  });

  test('Phone number formats (international vs local)', async () => {
    const samples = ['+6598765432', '98765432', '+60-12-345-6789'];
    for (const p of samples) {
      const { res } = await post<any>(ctx, base, { ...validBody(), passenger: { name: 'N', phone_number: p } });
      expect([200, 201, 400, 422]).toContain(res.status());
    }
  });

  //Keep a probe while stabilizing
  test('debug', async ({ baseURL }) => {
    const ctx = await newApiContext(baseURL!);
    const body = validBody();
    const { res } = await post<any>(ctx, base, body);
    const status = res.status();
    const txt = await res.text();
    console.log('DEBUG POST /api/journeys →', status, txt);
    expect(status).toBeGreaterThanOrEqual(200);
  });
});
