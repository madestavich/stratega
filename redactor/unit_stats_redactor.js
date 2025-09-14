let racesData = {};
let panels = {
  1: {
    currentUnit: null,
    currentRace: null,
    currentTier: null,
    currentUnitName: null,
  },
  2: {
    currentUnit: null,
    currentRace: null,
    currentTier: null,
    currentUnitName: null,
  },
};

// Load races data
async function loadRacesData() {
  try {
    const response = await fetch("../game_configs/races.json");
    racesData = await response.json();
    populateRaceFilter(1);
    populateRaceFilter(2);
  } catch (error) {
    console.error("Error loading races data:", error);
    alert(
      "Could not load races.json. Make sure the file exists in the correct path."
    );
  }
}

// Populate race filter for specific panel
function populateRaceFilter(panelId) {
  const raceFilter = document.getElementById(`raceFilter${panelId}`);
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
function onRaceChange(panelId) {
  const raceFilter = document.getElementById(`raceFilter${panelId}`);
  const tierFilter = document.getElementById(`tierFilter${panelId}`);
  const unitFilter = document.getElementById(`unitFilter${panelId}`);

  panels[panelId].currentRace = raceFilter.value;

  if (!panels[panelId].currentRace) {
    tierFilter.innerHTML = '<option value="">Select Tier</option>';
    unitFilter.innerHTML = '<option value="">Select Unit</option>';
    hideUnitEditor(panelId);
    return;
  }

  populateTierFilter(panelId, panels[panelId].currentRace);
  unitFilter.innerHTML = '<option value="">Select Unit</option>';
  hideUnitEditor(panelId);
}

// Populate tier filter
function populateTierFilter(panelId, race) {
  const tierFilter = document.getElementById(`tierFilter${panelId}`);
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
function onTierChange(panelId) {
  const tierFilter = document.getElementById(`tierFilter${panelId}`);
  const unitFilter = document.getElementById(`unitFilter${panelId}`);

  panels[panelId].currentTier = tierFilter.value;

  if (!panels[panelId].currentTier) {
    unitFilter.innerHTML = '<option value="">Select Unit</option>';
    hideUnitEditor(panelId);
    return;
  }

  populateUnitFilter(
    panelId,
    panels[panelId].currentRace,
    panels[panelId].currentTier
  );
  hideUnitEditor(panelId);
}

// Populate unit filter
function populateUnitFilter(panelId, race, tier) {
  const unitFilter = document.getElementById(`unitFilter${panelId}`);
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
function onUnitChange(panelId) {
  const unitFilter = document.getElementById(`unitFilter${panelId}`);
  panels[panelId].currentUnitName = unitFilter.value;

  if (!panels[panelId].currentUnitName) {
    hideUnitEditor(panelId);
    return;
  }

  panels[panelId].currentUnit =
    racesData[panels[panelId].currentRace].units[panels[panelId].currentTier][
      panels[panelId].currentUnitName
    ];
  showUnitEditor(panelId);
}

// Show unit editor
function showUnitEditor(panelId) {
  const unitEditor = document.getElementById(`unitEditor${panelId}`);
  unitEditor.style.display = "block";

  // Update unit info
  document.getElementById(`unitName${panelId}`).textContent = panels[
    panelId
  ].currentUnitName
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
  document.getElementById(`unitRace${panelId}`).textContent =
    panels[panelId].currentRace.charAt(0).toUpperCase() +
    panels[panelId].currentRace.slice(1);
  document.getElementById(`unitTier${panelId}`).textContent = panels[
    panelId
  ].currentTier
    .replace("_", " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());

  // Populate form fields
  populateUnitForm(panelId);
}

// Hide unit editor
function hideUnitEditor(panelId) {
  const unitEditor = document.getElementById(`unitEditor${panelId}`);
  unitEditor.style.display = "none";
}

// Populate unit form with current unit data
function populateUnitForm(panelId) {
  const currentUnit = panels[panelId].currentUnit;
  if (!currentUnit) return;

  // Basic stats
  document.getElementById(`gridWidth${panelId}`).value =
    currentUnit.gridWidth || 1;
  document.getElementById(`gridHeight${panelId}`).value =
    currentUnit.gridHeight || 1;
  document.getElementById(`moveSpeed${panelId}`).value =
    currentUnit.moveSpeed || 10;
  document.getElementById(`attackDamage${panelId}`).value =
    currentUnit.attackDamage || 10;
  document.getElementById(`attackSpeed${panelId}`).value =
    currentUnit.attackSpeed || 1;
  document.getElementById(`health${panelId}`).value = currentUnit.health || 50;

  // Ranged settings
  const isRanged = currentUnit.isRanged || false;
  document.getElementById(`isRanged${panelId}`).checked = isRanged;

  const rangedConfig = document.getElementById(`rangedConfig${panelId}`);
  if (isRanged) {
    rangedConfig.style.display = "block";
    document.getElementById(`minRangeDistance${panelId}`).value =
      currentUnit.minRangeDistance || 1;
    document.getElementById(`maxRangeDistance${panelId}`).value =
      currentUnit.maxRangeDistance || 10;

    // Bullet config
    if (currentUnit.bulletConfig) {
      document.getElementById(`bulletType${panelId}`).value =
        currentUnit.bulletConfig.bulletType || "bullet";
      document.getElementById(`bulletMoveSpeed${panelId}`).value =
        currentUnit.bulletConfig.moveSpeed || 30;
      document.getElementById(`bulletDamage${panelId}`).value =
        currentUnit.bulletConfig.bulletDamage || currentUnit.attackDamage || 20;
    } else {
      document.getElementById(`bulletType${panelId}`).value = "bullet";
      document.getElementById(`bulletMoveSpeed${panelId}`).value = 30;
      document.getElementById(`bulletDamage${panelId}`).value =
        currentUnit.attackDamage || 20;
    }
  } else {
    rangedConfig.style.display = "none";
  }
}

// Handle ranged checkbox change
function onRangedChange(panelId) {
  const isRanged = document.getElementById(`isRanged${panelId}`).checked;
  const rangedConfig = document.getElementById(`rangedConfig${panelId}`);

  if (isRanged) {
    rangedConfig.style.display = "block";
    // Set default values if not already set
    if (!document.getElementById(`minRangeDistance${panelId}`).value) {
      document.getElementById(`minRangeDistance${panelId}`).value = 3;
    }
    if (!document.getElementById(`maxRangeDistance${panelId}`).value) {
      document.getElementById(`maxRangeDistance${panelId}`).value = 15;
    }
    if (!document.getElementById(`bulletType${panelId}`).value) {
      document.getElementById(`bulletType${panelId}`).value = "bullet";
    }
    if (!document.getElementById(`bulletMoveSpeed${panelId}`).value) {
      document.getElementById(`bulletMoveSpeed${panelId}`).value = 30;
    }
    if (!document.getElementById(`bulletDamage${panelId}`).value) {
      document.getElementById(`bulletDamage${panelId}`).value =
        document.getElementById(`attackDamage${panelId}`).value || 20;
    }
  } else {
    rangedConfig.style.display = "none";
  }
}

// Save to localStorage for persistence
function saveToLocalStorage() {
  try {
    localStorage.setItem("racesData", JSON.stringify(racesData));
    localStorage.setItem("lastSaved", new Date().toISOString());
    return true;
  } catch (error) {
    console.error("Failed to save to localStorage:", error);
    return false;
  }
}

// Load from localStorage
function loadFromLocalStorage() {
  try {
    const saved = localStorage.getItem("racesData");
    if (saved) {
      racesData = JSON.parse(saved);
      const lastSaved = localStorage.getItem("lastSaved");
      console.log("Loaded from localStorage, last saved:", lastSaved);
      return true;
    }
  } catch (error) {
    console.error("Failed to load from localStorage:", error);
  }
  return false;
}

// Save unit changes
function saveUnit(panelId) {
  const currentUnit = panels[panelId].currentUnit;
  if (!currentUnit) return;

  // Validate inputs
  const gridWidth = parseInt(
    document.getElementById(`gridWidth${panelId}`).value
  );
  const gridHeight = parseInt(
    document.getElementById(`gridHeight${panelId}`).value
  );
  const moveSpeed = parseInt(
    document.getElementById(`moveSpeed${panelId}`).value
  );
  const attackDamage = parseInt(
    document.getElementById(`attackDamage${panelId}`).value
  );
  const attackSpeed = parseFloat(
    document.getElementById(`attackSpeed${panelId}`).value
  );
  const health = parseInt(document.getElementById(`health${panelId}`).value);

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
  const isRanged = document.getElementById(`isRanged${panelId}`).checked;
  if (isRanged) {
    currentUnit.isRanged = true;
    currentUnit.minRangeDistance = parseInt(
      document.getElementById(`minRangeDistance${panelId}`).value
    );
    currentUnit.maxRangeDistance = parseInt(
      document.getElementById(`maxRangeDistance${panelId}`).value
    );

    // Update bullet config
    currentUnit.bulletConfig = {
      bulletType: document.getElementById(`bulletType${panelId}`).value,
      moveSpeed: parseInt(
        document.getElementById(`bulletMoveSpeed${panelId}`).value
      ),
      bulletDamage: parseInt(
        document.getElementById(`bulletDamage${panelId}`).value
      ),
    };
  } else {
    delete currentUnit.isRanged;
    delete currentUnit.minRangeDistance;
    delete currentUnit.maxRangeDistance;
    delete currentUnit.bulletConfig;
  }

  // Update the races data
  racesData[panels[panelId].currentRace].units[panels[panelId].currentTier][
    panels[panelId].currentUnitName
  ] = currentUnit;

  // Save to localStorage
  if (saveToLocalStorage()) {
    alert(
      `Panel ${panelId}: Unit stats saved successfully!\n\nData saved to browser storage. Use "Download Modified JSON" to get the file.`
    );
  } else {
    alert(
      `Panel ${panelId}: Unit stats updated in memory, but failed to save to browser storage.`
    );
  }

  // Update save indicator
  updateSaveIndicator();
}

// Update save indicator
function updateSaveIndicator() {
  const lastSaved = localStorage.getItem("lastSaved");
  if (lastSaved) {
    const saveTime = new Date(lastSaved).toLocaleString();
    document.title = `Unit Stats Redactor - Last saved: ${saveTime}`;
  }
}

// Download modified JSON file
function downloadModifiedJSON() {
  const dataStr = JSON.stringify(racesData, null, 2);
  const dataBlob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "races_modified.json";
  link.click();
  URL.revokeObjectURL(url);

  alert(
    "Modified JSON file downloaded!\n\nTo apply changes to your game:\n1. Replace the original races.json with this file\n2. Or copy the contents to your races.json file"
  );
}

// Save changes to clipboard as JSON patch
function saveChangesToClipboard(panelId) {
  const currentUnit = panels[panelId].currentUnit;
  if (!currentUnit) return;

  const unitPath = `racesData.${panels[panelId].currentRace}.units.${panels[panelId].currentTier}.${panels[panelId].currentUnitName}`;
  const changeLog = {
    timestamp: new Date().toISOString(),
    unitPath: unitPath,
    changes: currentUnit,
  };

  const changeText = `// Unit changes for ${panels[panelId].currentUnitName}
// Timestamp: ${changeLog.timestamp}
// Path: ${unitPath}

${JSON.stringify(currentUnit, null, 2)}

// To apply: Replace the unit object at the specified path with this data`;

  navigator.clipboard
    .writeText(changeText)
    .then(() => {
      alert(
        `Panel ${panelId}: Unit changes copied to clipboard!\n\nYou can paste this into a text file for manual application.`
      );
    })
    .catch((err) => {
      console.error("Failed to copy: ", err);
      alert(`Panel ${panelId}: Failed to copy changes to clipboard`);
    });
}

// Copy unit data to clipboard
function copyUnit(panelId) {
  const currentUnit = panels[panelId].currentUnit;
  if (!currentUnit) return;

  const unitData = JSON.stringify(currentUnit, null, 2);
  navigator.clipboard
    .writeText(unitData)
    .then(() => {
      alert(`Panel ${panelId}: Unit data copied to clipboard!`);
    })
    .catch((err) => {
      console.error("Failed to copy: ", err);
      alert(`Panel ${panelId}: Failed to copy unit data`);
    });
}

// Compare units between panels
function compareUnits() {
  const unit1 = panels[1].currentUnit;
  const unit2 = panels[2].currentUnit;

  if (!unit1 || !unit2) {
    alert("Please select units in both panels to compare");
    return;
  }

  const comparison = {
    unit1: {
      name: panels[1].currentUnitName,
      race: panels[1].currentRace,
      tier: panels[1].currentTier,
      stats: unit1,
    },
    unit2: {
      name: panels[2].currentUnitName,
      race: panels[2].currentRace,
      tier: panels[2].currentTier,
      stats: unit2,
    },
  };

  const comparisonText = `
UNIT COMPARISON
===============

Panel 1: ${comparison.unit1.name} (${comparison.unit1.race} - ${
    comparison.unit1.tier
  })
Panel 2: ${comparison.unit2.name} (${comparison.unit2.race} - ${
    comparison.unit2.tier
  })

Grid Size: ${unit1.gridWidth}x${unit1.gridHeight} vs ${unit2.gridWidth}x${
    unit2.gridHeight
  }
Health: ${unit1.health} vs ${unit2.health}
Attack Damage: ${unit1.attackDamage} vs ${unit2.attackDamage}
Attack Speed: ${unit1.attackSpeed} vs ${unit2.attackSpeed}
Move Speed: ${unit1.moveSpeed} vs ${unit2.moveSpeed}
Ranged: ${unit1.isRanged ? "Yes" : "No"} vs ${unit2.isRanged ? "Yes" : "No"}

${
  unit1.isRanged
    ? `Range: ${unit1.minRangeDistance}-${unit1.maxRangeDistance}`
    : ""
}
${
  unit2.isRanged
    ? `Range: ${unit2.minRangeDistance}-${unit2.maxRangeDistance}`
    : ""
}
`;

  console.log(comparisonText);
  alert("Comparison logged to console. Press F12 to view detailed comparison.");
}

// Export JSON data (alias for downloadModifiedJSON)
function exportData() {
  downloadModifiedJSON();
}

// Check for unsaved changes
function hasUnsavedChanges() {
  const lastSaved = localStorage.getItem("lastSaved");
  return !lastSaved; // Simple check - could be more sophisticated
}

// Warning before leaving page
window.addEventListener("beforeunload", function (e) {
  if (hasUnsavedChanges()) {
    e.preventDefault();
    e.returnValue = "";
  }
});

// Event listeners
document.addEventListener("DOMContentLoaded", function () {
  // Try to load from localStorage first
  if (!loadFromLocalStorage()) {
    loadRacesData();
  } else {
    populateRaceFilter(1);
    populateRaceFilter(2);
    updateSaveIndicator();
    console.log("Loaded data from browser storage");
  }

  // Panel 1 event listeners
  document
    .getElementById("raceFilter1")
    .addEventListener("change", () => onRaceChange(1));
  document
    .getElementById("tierFilter1")
    .addEventListener("change", () => onTierChange(1));
  document
    .getElementById("unitFilter1")
    .addEventListener("change", () => onUnitChange(1));
  document
    .getElementById("isRanged1")
    .addEventListener("change", () => onRangedChange(1));

  // Panel 2 event listeners
  document
    .getElementById("raceFilter2")
    .addEventListener("change", () => onRaceChange(2));
  document
    .getElementById("tierFilter2")
    .addEventListener("change", () => onTierChange(2));
  document
    .getElementById("unitFilter2")
    .addEventListener("change", () => onUnitChange(2));
  document
    .getElementById("isRanged2")
    .addEventListener("change", () => onRangedChange(2));

  // Keyboard shortcuts
  document.addEventListener("keydown", function (e) {
    if (e.ctrlKey && e.key === "s") {
      e.preventDefault();
      // Save both panels if they have units selected
      if (panels[1].currentUnit) saveUnit(1);
      if (panels[2].currentUnit) saveUnit(2);
    }
    if (e.ctrlKey && e.key === "e") {
      e.preventDefault();
      exportData();
    }
    if (e.ctrlKey && e.key === "c" && e.altKey) {
      e.preventDefault();
      compareUnits();
    }
  });
});
