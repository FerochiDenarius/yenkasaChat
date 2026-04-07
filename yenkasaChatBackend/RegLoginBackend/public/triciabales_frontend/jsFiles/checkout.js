function getCart() {
  return JSON.parse(localStorage.getItem("cart") || "[]");
}

document.getElementById("checkout-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const cart = getCart();

  if (cart.length === 0) {
    alert("Your cart is empty.");
    return;
  }

  const customerName = document.getElementById("customerName").value;
  const phone = document.getElementById("phone").value;
  const address = document.getElementById("address").value;

  const payload = {
    customerName,
    phone,
    address,
    items: cart.map(item => ({
      baleId: item.id,
      baleName: item.name,
      price: item.price,
      quantity: item.quantity
    }))
  };

  try {
    const response = await fetch(
      "https://www.yenkasa.xyz/triciabales-api/api/orders/checkout",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Checkout failed");
    }

    localStorage.removeItem("cart");

    alert("Order placed successfully!");

    window.location.href = "thank-you.html";

  } catch (err) {
    console.error(err);
    alert("Could not place order. Please try again.");
  }
});
