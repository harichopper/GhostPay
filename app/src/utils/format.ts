export function shortAddress(address: string, head = 6, tail = 6): string {
  if (!address) {
    return 'Not set';
  }

  if (address.length <= head + tail) {
    return address;
  }

  return `${address.slice(0, head)}...${address.slice(-tail)}`;
}

export function formatAlgo(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '--';
  }

  return `${value.toFixed(3)} ALGO`;
}

export function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleString();
}
