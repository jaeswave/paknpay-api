const calculateAmount = (
  entryTime,
  exitTime = new Date(),
  ratePerHour = 300,
  minimumCharge = 200,
  gracePeriodMinutes = 10
) => {
  const diffMs = new Date(exitTime) - new Date(entryTime);
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes <= gracePeriodMinutes) return 0;
  const billableMinutes = diffMinutes - gracePeriodMinutes;
  const billableHours = billableMinutes / 60;
  const amount = billableHours * ratePerHour;
  const rounded = Math.ceil(amount / 50) * 50;
  return Math.max(rounded, minimumCharge);
};

const formatDuration = (entryTime, exitTime = new Date()) => {
  const diffMs = new Date(exitTime) - new Date(entryTime);
  const hours = Math.floor(diffMs / 3600000);
  const minutes = Math.floor((diffMs % 3600000) / 60000);
  if (hours === 0) return `${minutes} min`;
  return `${hours}h ${minutes}min`;
};

module.exports = { calculateAmount, formatDuration };
