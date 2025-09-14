let racesData = {};
let currentUnit = null;
let currentRace = null;
let currentTier = null;
let currentUnitName = null;

// Load races data
async function loadRacesData() {
  try {
    const response = await fetch("../game_configs/races.json");
    racesData = await response.json();
    populateRaceFilter();
  } catch (error) {
    console.error("Error loading races data:", error);
    // Fallback - you can paste the races data here if needed
    alert(
      "Could not load races.json. Make sure the file exists in the correct path."
    );
  }
}

// Populate race filter
function populateRaceFilter() {
  const raceFilter = document.getElementById("raceFilter");
  raceFilter.innerHTML = '<option value="">Select Race</option>';

  Object.keys(racesData).forEach((race) => {
    if (
      racesData[race].units &&
      Object.keys(racesData[race].units).length > 0
    ) {
      const option = document.createElement("option");
      option.value = race;
      option.textContent = race.charAt(0).toUpperCase() + race.slice(1);
      raceFilter.appendChild(option);
    }
  });
}

// Handle race selection
function onRaceChange() {
  const raceFilter = document.getElementById("raceFilter");
  const tierFilter = document.getElementById("tierFilter");
  const unitFilter = document.getElementById("unitFilter");

  currentRace = raceFilter.value;

  if (!currentRace) {
    tierFilter.innerHTML = '<option value="">Select Tier</option>';
    unitFilter.innerHTML = '<option value="">Select Unit</option>';
    hideUnitEditor();
    return;
  }

  populateTierFilter(currentRace);
  unitFilter.innerHTML = '<option value="">Select Unit</option>';
  hideUnitEditor();
}

// Populate tier filter
function populateTierFilter(race) {
  const tierFilter = document.getElementById("tierFilter");
  tierFilter.innerHTML = '<option value="">Select Tier</option>';

  const units = racesData[race].units;
  Object.keys(units).forEach((tier) => {
    if (Object.keys(units[tier]).length > 0) {
      const option = document.createElement("option");
      option.value = tier;
      option.textContent = tier
        .replace("_", " ")
        .replace(/\b\w/g, (l) => l.toUpperCase());
      tierFilter.appendChild(option);
    }
  });
}

// Handle tier selection
function onTierChange() {
  const tierFilter = document.getElementById("tierFilter");
  const unitFilter = document.getElementById("unitFilter");

  currentTier = tierFilter.value;

  if (!currentTier) {
    unitFilter.innerHTML = '<option value="">Select Unit</option>';
    hideUnitEditor();
    return;
  }

  populateUnitFilter(currentRace, currentTier);
  hideUnitEditor();
}

// Populate unit filter
function populateUnitFilter(race, tier) {
  const unitFilter = document.getElementById("unitFilter");
  unitFilter.innerHTML = '<option value="">Select Unit</option>';

  const units = racesData[race].units[tier];
  Object.keys(units).forEach((unitName) => {
    const option = document.createElement("option");
    option.value = unitName;
    option.textContent = unitName
      .replace(/_/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());
    unitFilter.appendChild(option);
  });
}

// Handle unit selection
function onUnitChange() {
  const unitFilter = document.getElementById("unitFilter");
  currentUnitName = unitFilter.value;

  if (!currentUnitName) {
    hideUnitEditor();
    return;
  }

  currentUnit = racesData[currentRace].units[currentTier][currentUnitName];
  showUnitEditor();
}

// Show unit editor
function showUnitEditor() {
  const unitEditor = document.getElementById("unitEditor");
  unitEditor.style.display = "grid";

  // Update unit info
  document.getElementById("unitName").textContent = currentUnitName
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
  document.getElementById("unitRace").textContent =
    currentRace.charAt(0).toUpperCase() + currentRace.slice(1);
  document.getElementById("unitTier").textContent = currentTier
    .replace("_", " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());

  // Populate form fields
  populateUnitForm();
}

// Hide unit editor
function hideUnitEditor() {
  const unitEditor = document.getElementById("unitEditor");
  unitEditor.style.display = "none";
}

// Populate unit form with current unit data
function populateUnitForm() {
  if (!currentUnit) return;

  // Basic stats
  document.getElementById("gridWidth").value = currentUnit.gridWidth || 1;
  document.getElementById("gridHeight").value = currentUnit.gridHeight || 1;
  document.getElementById("moveSpeed").value = currentUnit.moveSpeed || 10;
  document.getElementById("attackDamage").value =
    currentUnit.attackDamage || 10;
  document.getElementById("attackSpeed").value = currentUnit.attackSpeed || 1;
  document.getElementById("health").value = currentUnit.health || 50;

  // Ranged settings
  const isRanged = currentUnit.isRanged || false;
  document.getElementById("isRanged").checked = isRanged;

  const rangedConfig = document.getElementById("rangedConfig");
  if (isRanged) {
    rangedConfig.style.display = "block";
    document.getElementById("minRangeDistance").value =
      currentUnit.minRangeDistance || 1;
    document.getElementById("maxRangeDistance").value =
      currentUnit.maxRangeDistance || 10;

    // Bullet config
    if (currentUnit.bulletConfig) {
      document.getElementById("bulletType").value =
        currentUnit.bulletConfig.bulletType || "bullet";
      document.getElementById("bulletMoveSpeed").value =
        currentUnit.bulletConfig.moveSpeed || 30;
      document.getElementById("bulletDamage").value =
        currentUnit.bulletConfig.bulletDamage || currentUnit.attackDamage || 20;
    } else {
      document.getElementById("bulletType").value = "bullet";
      document.getElementById("bulletMoveSpeed").value = 30;
      document.getElementById("bulletDamage").value =
        currentUnit.attackDamage || 20;
    }
  } else {
    rangedConfig.style.display = "none";
  }
}

// Handle ranged checkbox change
function onRangedChange() {
  const isRanged = document.getElementById("isRanged").checked;
  const rangedConfig = document.getElementById("rangedConfig");

  if (isRanged) {
    rangedConfig.style.display = "block";
    // Set default values if not already set
    if (!document.getElementById("minRangeDistance").value) {
      document.getElementById("minRangeDistance").value = 3;
    }
    if (!document.getElementById("maxRangeDistance").value) {
      document.getElementById("maxRangeDistance").value = 15;
    }
    if (!document.getElementById("bulletType").value) {
      document.getElementById("bulletType").value = "bullet";
    }
    if (!document.getElementById("bulletMoveSpeed").value) {
      document.getElementById("bulletMoveSpeed").value = 30;
    }
    if (!document.getElementById("bulletDamage").value) {
      document.getElementById("bulletDamage").value =
        document.getElementById("attackDamage").value || 20;
    }
  } else {
    rangedConfig.style.display = "none";
  }
}

// Save unit changes
function saveUnit() {
  if (!currentUnit) return;

  // Validate inputs
  const gridWidth = parseInt(document.getElementById("gridWidth").value);
  const gridHeight = parseInt(document.getElementById("gridHeight").value);
  const moveSpeed = parseInt(document.getElementById("moveSpeed").value);
  const attackDamage = parseInt(document.getElementById("attackDamage").value);
  const attackSpeed = parseFloat(document.getElementById("attackSpeed").value);
  const health = parseInt(document.getElementById("health").value);

  if (
    gridWidth < 1 ||
    gridHeight < 1 ||
    moveSpeed < 1 ||
    attackDamage < 1 ||
    attackSpeed < 0.1 ||
    health < 1
  ) {
    alert("Please enter valid values for all fields");
    return;
  }

  // Update basic stats
  currentUnit.gridWidth = gridWidth;
  currentUnit.gridHeight = gridHeight;
  currentUnit.moveSpeed = moveSpeed;
  currentUnit.attackDamage = attackDamage;
  currentUnit.attackSpeed = attackSpeed;
  currentUnit.health = health;

  // Update ranged settings
  const isRanged = document.getElementById("isRanged").checked;
  if (isRanged) {
    currentUnit.isRanged = true;
    currentUnit.minRangeDistance = parseInt(
      document.getElementById("minRangeDistance").value
    );
    currentUnit.maxRangeDistance = parseInt(
      document.getElementById("maxRangeDistance").value
    );

    // Update bullet config
    currentUnit.bulletConfig = {
      bulletType: document.getElementById("bulletType").value,
      moveSpeed: parseInt(document.getElementById("bulletMoveSpeed").value),
      bulletDamage: parseInt(document.getElementById("bulletDamage").value),
    };
  } else {
    delete currentUnit.isRanged;
    delete currentUnit.minRangeDistance;
    delete currentUnit.maxRangeDistance;
    delete currentUnit.bulletConfig;
  }

  // Update the races data
  racesData[currentRace].units[currentTier][currentUnitName] = currentUnit;

  alert("Unit stats saved successfully!");
}

// Export JSON data
function exportData() {
  const dataStr = JSON.stringify(racesData, null, 2);
  const dataBlob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "races_modified.json";
  link.click();
  URL.revokeObjectURL(url);
}

// Copy current unit
function copyUnit() {
  if (!currentUnit) return;

  const unitData = JSON.stringify(currentUnit, null, 2);
  navigator.clipboard
    .writeText(unitData)
    .then(() => {
      alert("Unit data copied to clipboard!");
    })
    .catch((err) => {
      console.error("Failed to copy: ", err);
      alert("Failed to copy unit data");
    });
}

// Reset unit to original values
function resetUnit() {
  if (
    !currentUnit ||
    !confirm("Are you sure you want to reset this unit to original values?")
  )
    return;

  // Reload the unit from the original data
  onUnitChange();
}

// Event listeners
document.addEventListener("DOMContentLoaded", function () {
  loadRacesData();

  document
    .getElementById("raceFilter")
    .addEventListener("change", onRaceChange);
  document
    .getElementById("tierFilter")
    .addEventListener("change", onTierChange);
  document
    .getElementById("unitFilter")
    .addEventListener("change", onUnitChange);
  document
    .getElementById("isRanged")
    .addEventListener("change", onRangedChange);

  // Add keyboard shortcuts
  document.addEventListener("keydown", function (e) {
    if (e.ctrlKey && e.key === "s") {
      e.preventDefault();
      saveUnit();
    }
    if (e.ctrlKey && e.key === "e") {
      e.preventDefault();
      exportData();
    }
  });
});

// Helper function to format numbers
function formatNumber(value, decimals = 0) {
  return parseFloat(value).toFixed(decimals);
}

// Validation functions
function validatePositiveInteger(value) {
  const num = parseInt(value);
  return !isNaN(num) && num > 0;
}

function validatePositiveFloat(value) {
  const num = parseFloat(value);
  return !isNaN(num) && num > 0;
}
