fetch("http://localhost:8080/api/triciabales")
  .then(res => res.json())
  .then(data => {
    console.log("Bales:", data);

    const container = document.getElementById("bale-container");

    data.forEach(bale => {

      const card = document.createElement("div");
      card.className = "card";

card.innerHTML = `
  <h3>${bale.name}</h3>

  <p class="status ${bale.status}">
    ${bale.status.toUpperCase()}
  </p>

  <p><strong>Price:</strong> GHS ${bale.price}</p>
  <p><strong>Weight:</strong> ${bale.weight}</p>
  <p>${bale.description}</p>

  <img src="http://localhost:8080${bale.imageUrl}" />

  ${
    bale.videoUrl
      ? `<video controls src="http://localhost:8080${bale.videoUrl}"></video>`
      : ""
  }

  <br><br>

  ${
    bale.status !== "sold"
      ? `<a href="https://wa.me/233551699010?text=Hello%20Tricia,%20I%20am%20interested%20in%20${bale.name}" target="_blank">
          <button>💬 Chat on WhatsApp</button>
        </a>`
      : `<button disabled style="background: gray;">❌ Sold Out</button>`
  }
`;

      container.appendChild(card);
    });
  })
  .catch(err => console.error(err));