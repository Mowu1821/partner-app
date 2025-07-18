const app = document.getElementById('app');

// Random user details generator
function generateRandomUserDetails() {
  const names = ['Alice', 'Bob', 'Charlie', 'David', 'Eve'];
  const emails = ['alice@example.com', 'bob@example.com', 'charlie@example.com', 'david@example.com', 'eve@example.com'];
  const ids = [1001, 1002, 1003, 1004, 1005];

  const randomIndex = Math.floor(Math.random() * names.length);
  return {
    name: names[randomIndex],
    email: emails[randomIndex],
    id: ids[randomIndex]
  };
}

// Render Login Page
function renderLoginPage() {
  app.innerHTML = `
    <h2>Login Page</h2>
    <button onclick="renderTypeLoginPage()">Go to Type Login</button>
  `;
  console.log("In the renderTypeLogin");
  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get("orderID"); // assuming orderID is part of result.data
  console.log("Order ID from URL:", orderId);

  if (orderId) {
    // Start polling for the authentication status
    pollAuthenticationStatus(orderId);
  }
}

// Render Type Login Page
function renderTypeLoginPage() {
  app.innerHTML = `
    <h2>Type Login</h2>
    <button onclick="loginWithMyIDOnSameDevice()">Login with myID on the same device</button>
    <button onclick="generateQRCodeForAnotherDevice()">Login with myID on another device</button>
  `;

}

// Render User Dashboard Page
function renderUserDashboardPage(userDetails) {
  // const userDetails = generateRandomUserDetails();
  console.log("In the render dashboad");
  const randomHeader = `Welcome, ${userDetails.name}!`;
  const randomFooter = `Thank you for visiting, ${userDetails.name}!`;

  document.getElementById('header').textContent = randomHeader;
  document.getElementById('footer').textContent = randomFooter;

  app.innerHTML = `
    <div class="user-dashboard">
      <h2>User Dashboard</h2>
      <p><strong>Name:</strong> ${userDetails.name}</p>
      <p><strong>Phone Number:</strong> ${userDetails.phoneNumber}</p>
      <p><strong>National Identity Number:</strong> ${userDetails.nin}</p>
      <p><strong>Bank Verfication Number:</strong> ${userDetails.bvn}</p>
    </div>
  `;
}

// Function Polling for authentication status
async function pollAuthenticationStatus(orderId, maxAttempts = 60, interval = 3000) {
  let attempts = 0;

  // Polling for authentication status
  const poll = async () => {
    attempts++;

    try {
      console.log("Proceed to polling");
      // const response = await fetch(`https://proj-ei-d-backend.vercel.app/api/auth/status/${orderId}`);
      const response = await fetch(`http://localhost:5000/api/auth/status/${orderId}`);

      if (!response.ok) {
        console.error('Failed to get authentication status');
        return;
      }

      const result = await response.json();

      console.log("result", result);
      console.log("response", response);

      if (response.status === 200 && result?.data?.status === "Scanned") {
        // If the status is scanned, show appropriate loading interface
        const qrCodeContainer = document.getElementById("qr-code-container");
        if (qrCodeContainer) {
          qrCodeContainer.innerHTML = `<div class="loader"></div>`;
        }

        app.innerHTML = `
          <h2>Authenticate with MyID app to proceed</h2>
          <div class="loader-container">
            <div class="loader"></div>
            <p>Waiting for confirmation...</p>
          </div>
        `;
        // Continue polling for the next status
        setTimeout(poll, interval);
      }
      else if (response.status === 200 && result?.data?.status === "Completed") {
        // If the status is completed, fetch the user data and render the dashboard
        console.log("Authentication successful. Rendering dashboard...");
        const userData = result.data.user;
        renderUserDashboardPage(userData); // Pass user data to dashboard function
      }
      else if (attempts < maxAttempts) {
        // Poll again if status is still pending
        setTimeout(poll, interval);
      } else {
        console.log('Max polling attempts reached. Authentication still pending.');
        alert('Authentication still pending.');
      }
    } catch (error) {
      console.error('Error polling authentication status:', error);
    }
  };

  // Start polling
  poll();
}

// Call API before proceeding with login method
async function initiateAuthentication() {
  try {
    // const response = await fetch("https://proj-ei-d-backend.vercel.app/api/authenticate", {
    const response = await fetch("http://localhost:5000/api/authenticate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ipAddress: "192.168.1.1", // Replace with actual user IP
        deviceInfo: {
          deviceModel: "Pixel 6",
          deviceOS: "Android 13",
        },
        location: {
          latitude: 37.7749,
          longitude: -122.4194,
        },
        requestBodyName: "TestWebsite.com"
      }),
    });

    const result = await response.json();
    return result.data; // Contains orderID, tokens

  } catch (error) {
    console.error("Error initiating authentication:", error);
    alert("Failed to authenticate.");
  }
}

const callBackUrl = `https://deep-link-xi.vercel.app/?orderID`;

// Login with MyID on the Same Device (Deep Link)
async function loginWithMyIDOnSameDevice() {
  alert("Attempting to open the my app...");

  const authData = await initiateAuthentication();
  if (!authData) return;

  const orderId = authData.sameDevice.orderID; // assuming orderID is part of result.data

  if (orderId) {
    // Start polling for the authentication status
    pollAuthenticationStatus(orderId);
  }

  const deepLinkUrl = `myapp://identify?callback_url=${callBackUrl}&orderID=${authData.sameDevice.orderID}&token=${authData.sameDevice.autoTriggerToken}&requestBodyName=${authData.requestBodyName}`;
  window.open(deepLinkUrl, "_blank");
}

// Generate QR Code for another device
async function generateQRCodeForAnotherDevice() {
  const authData = await initiateAuthentication();
  if (!authData) return;

  const orderId = authData.differentDevice.orderID; // assuming orderID is part of result.data

  if (orderId) {
    // Start polling for the authentication status
    pollAuthenticationStatus(orderId);
  }


  // const qrCodeData = `myapp://auth?orderID=${authData.differentDevice.orderID}&token=${authData.differentDevice.qrCodeToken}&qrCodePassString=${authData.differentDevice.qrCodePassString}&requestBodyName=${authData.requestBodyName}`;
  const qrCodeData = `myapp://identify?callback_url=${callBackUrl}&orderID=${authData.differentDevice.orderID}&token=${authData.differentDevice.qrCodeToken}&qrCodePassString=${authData.differentDevice.qrCodePassString}&requestBodyName=${authData.requestBodyName}`;

  console.log("QR Code Data:", qrCodeData);

  // Display the QR code
  app.innerHTML = `
    <h2>Scan this QR Code on another device</h2>
    <div id="qr-code-container"></div>
    <p>This QR code contains a secure token for authentication.</p>
  `;

  setTimeout(() => {
    const qrCodeContainer = document.getElementById("qr-code-container");
    if (!qrCodeContainer) {
      console.error("Error: QR code container not found in the DOM.");
      return;
    }

    const qr = qrcode(0, "M");
    qr.addData(qrCodeData);
    qr.make();

    const imgTag = qr.createImgTag(4, 4);
    qrCodeContainer.innerHTML = imgTag;
  }, 0);
}

// Helper function to generate a random token
function generateRandomToken(length = 16) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

// Initial page load
renderLoginPage();