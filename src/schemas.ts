import { z } from 'zod';

export const coordsSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180)
});

export const passengerSchema = z.object({
  name: z.string().min(1),
  surname: z.string().optional(),
  phone_number: z.string().min(5)
});

export const createJourneyReqSchema = z.object({
  pickup: coordsSchema,
  dropoff: coordsSchema,
  passenger: passengerSchema,
  departure_date: z.string().datetime()
});

export const idSchema = z.string().min(1);

export const createJourneyResSchema = z.object({
  _id: idSchema
});

export const getJourneyResSchema = z.object({
  _id: idSchema,
  pickup: coordsSchema,
  dropoff: coordsSchema,
  passenger: passengerSchema.extend({ surname: z.string().optional() }),
  departure_date: z.string()
});
