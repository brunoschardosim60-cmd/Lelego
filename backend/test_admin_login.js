const email = "brunoschardosim60@gmail.com";
const password = "Aa1234@Lets";

async function main() {
  try {
    const health = await fetch("http://localhost:8000/api/auth/health");
    console.log("health", health.status, await health.text());

    const login = await fetch("http://localhost:8000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const body = await login.text();
    console.log("login", login.status, body);

    if (!login.ok) {
      process.exit(1);
    }
  } catch (error) {
    console.error("ERR", error.message);
    process.exit(2);
  }
}

main();
