const input = document.querySelector("#file");
const drop = document.querySelector("#drop");
const nameEl = document.querySelector("#name");
const format = document.querySelector("#format");
const button = document.querySelector("#convert");
const status = document.querySelector("#status");

let selected = null;

function choose(file) {
  if (!file) return;

  if (!file.type.startsWith("video/")) {
    status.textContent = "Please choose a video file.";
    return;
  }

  selected = file;
  nameEl.textContent = file.name;
  button.disabled = false;
  status.textContent = "Ready.";
}

input.addEventListener("change", (e) => {
  choose(e.target.files[0]);
});

["dragenter", "dragover"].forEach((type) => {
  drop.addEventListener(type, (e) => {
    e.preventDefault();
    drop.classList.add("drag");
  });
});

["dragleave", "drop"].forEach((type) => {
  drop.addEventListener(type, (e) => {
    e.preventDefault();
    drop.classList.remove("drag");
  });
});

drop.addEventListener("drop", (e) => {
  choose(e.dataTransfer.files[0]);
});

button.addEventListener("click", async () => {
  if (!selected) return;

  button.disabled = true;
  status.textContent = "Converting…";

  const data = new FormData();
  data.append("video", selected);
  data.append("format", format.value);

  try {
    const response = await fetch("/convert", {
      method: "POST",
      body: data
    });

    if (!response.ok) {
      let message = "Conversion failed.";

      try {
        const result = await response.json();
        message = result.error || message;
      } catch {}

      throw new Error(message);
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download =
      selected.name.replace(/\.[^.]+$/, "") +
      "." +
      format.value;

    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);

    status.textContent = "Done — audio downloaded.";
  } catch (error) {
    status.textContent =
      error.message || "Conversion failed.";
  } finally {
    button.disabled = false;
  }
});
