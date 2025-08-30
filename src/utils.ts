export function futureIso(minutesAhead = 60): string {
  return new Date(Date.now() + minutesAhead * 60_000).toISOString();
}

export function validBody() {
  return {
    pickup: { latitude: 1.3521, longitude: 103.8198 },
    dropoff: { latitude: 1.2801, longitude: 103.85 },
    passenger: { name: 'John', surname: 'Doe', phone_number: '+6598765432' },
    departure_date: futureIso(120)
  };
}
