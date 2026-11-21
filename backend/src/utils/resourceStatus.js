
export const calculateResourceStatus = (resource) => {
  const {
    availableQuantity,
    reservedQuantity,
    borrowedQuantity,
    isTemporarilyUnavailable
  } = resource;

  if (isTemporarilyUnavailable === true) {
    return 'Unavailable';
  }

  if (availableQuantity > 0) {
    return 'Available';
  }

  if (availableQuantity === 0 && reservedQuantity > 0) {
    return 'Reserved';
  }

  if (
    availableQuantity === 0 &&
    reservedQuantity === 0 &&
    borrowedQuantity > 0
  ) {
    return 'Borrowed';
  }

  throw new Error('Unable to determine resource status from inventory quantities');
};
