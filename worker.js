export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || 'CLI';
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      'http://localhost:5176',
      'http://localhost:5177',
      'http://localhost:3000',
      'https://jaidenschembri.github.io'
    ];

    const corsHeaders = {
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Origin':
        allowedOrigins.includes(origin) || origin === 'CLI'
          ? origin === 'CLI' ? '*' : origin
          : allowedOrigins.at(-1)
    };

    const jsonHeaders = {
      ...corsHeaders,
      'Content-Type': 'application/json'
    };

    async function hash(text) {
      try {
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const hashBuffer = await crypto.subtle.digest("SHA-256", data);
        return Array.from(new Uint8Array(hashBuffer))
          .map(b => b.toString(16).padStart(2, "0"))
          .join("");
      } catch (err) {
        console.error("Hash error:", err);
        throw err;
      }
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders, status: 204 });
    }

    // Normalize pathname to avoid issues with double slashes
    const normalizedPathname = url.pathname.replace(/^\/+|\/+$/g, '');
    console.log("Normalized pathname:", normalizedPathname); // Log pathname for debugging

    // === Admin log fetch ===
    if (request.method === 'GET' && url.searchParams.get('mode') === 'admin') {
      try {
        const list = await env.CONVERSATIONS.list();
        const keys = list.keys.sort((a, b) => b.name.localeCompare(a.name));
        const logs = [];

        for (const key of keys.slice(0, 50)) {
          const val = await env.CONVERSATIONS.get(key.name, "json");
          if (val?.user && val?.bot) {
            logs.push({
              timestamp: key.name.split('_')[0],
              user: val.user,
              bot: val.bot
            });
          }
        }

        return new Response(JSON.stringify(logs), { status: 200, headers: jsonHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: 'Failed to fetch logs', details: err.message }), {
          status: 500,
          headers: jsonHeaders
        });
      }
    }

    // === Signup ===
    if (request.method === "POST" && normalizedPathname === "signup") {
      try {
        const bodyText = await request.text();
        console.log("Signup request body:", bodyText); // Log raw body
        let body;
        try {
          body = JSON.parse(bodyText);
        } catch (e) {
          return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
            status: 400,
            headers: jsonHeaders
          });
        }
        const { email, password, username } = body;
        if (!email || !password || !username) {
          return new Response(JSON.stringify({ error: "Missing fields" }), {
            status: 400,
            headers: jsonHeaders
          });
        }

        const userKey = `user:${email.toLowerCase()}`;
        const existing = await env.AUTH_USERS.get(userKey);
        if (existing) {
          return new Response(JSON.stringify({ error: "Email already registered" }), {
            status: 409,
            headers: jsonHeaders
          });
        }

        const hashedPassword = await hash(password);
        const userData = {
          email: email.toLowerCase(),
          password: hashedPassword,
          username,
          pfp: "",
          botName: "jaiden",
          xp: 0,
          level: 1,
          likes: [],
          topics: [],
          memory: []
        };

        await env.AUTH_USERS.put(userKey, JSON.stringify(userData));
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: jsonHeaders
        });

      } catch (err) {
        console.error("Signup error:", err);
        return new Response(JSON.stringify({ error: "Signup failed", details: err.message }), {
          status: 500,
          headers: jsonHeaders
        });
      }
    }

    // === Login ===
    if (request.method === "POST" && normalizedPathname === "login") {
      try {
        const bodyText = await request.text();
        console.log("Login request body:", bodyText); // Log raw body
        let body;
        try {
          body = JSON.parse(bodyText);
        } catch (e) {
          return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
            status: 400,
            headers: jsonHeaders
          });
        }
        const { email, password } = body;
        if (!email || !password) {
          return new Response(JSON.stringify({ error: "Missing email or password" }), {
            status: 400,
            headers: jsonHeaders
          });
        }

        const userKey = `user:${email.toLowerCase()}`;
        const existing = await env.AUTH_USERS.get(userKey);
        if (!existing) {
          return new Response(JSON.stringify({ error: "User not found" }), {
            status: 404,
            headers: jsonHeaders
          });
        }

        const userData = JSON.parse(existing);
        const hashedInput = await hash(password);

        if (userData.password !== hashedInput) {
          return new Response(JSON.stringify({ error: "Invalid password" }), {
            status: 401,
            headers: jsonHeaders
          });
        }

        return new Response(JSON.stringify({ success: true, user: userData }), {
          status: 200,
          headers: jsonHeaders
        });

      } catch (err) {
        console.error("Login error:", err);
        return new Response(JSON.stringify({ error: "Login failed", details: err.message }), {
          status: 500,
          headers: jsonHeaders
        });
      }
    }

    // === Sync ===
    if (request.method === "POST" && normalizedPathname === "sync") {
      try {
        const bodyText = await request.text();
        console.log("Sync request body:", bodyText); // Log raw body
        let body;
        try {
          body = JSON.parse(bodyText);
        } catch (e) {
          return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
            status: 400,
            headers: jsonHeaders
          });
        }
        const { email, updates } = body;
        if (!email || !updates || typeof updates !== "object") {
          return new Response(JSON.stringify({ error: "Invalid sync payload" }), {
            status: 400,
            headers: jsonHeaders
          });
        }

        const userKey = `user:${email.toLowerCase()}`;
        const existing = await env.AUTH_USERS.get(userKey);
        if (!existing) {
          return new Response(JSON.stringify({ error: "User not found" }), {
            status: 404,
            headers: jsonHeaders
          });
        }

        const userData = JSON.parse(existing);
        const updatedUser = { ...userData, ...updates };

        await env.AUTH_USERS.put(userKey, JSON.stringify(updatedUser));
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: jsonHeaders
        });

      } catch (err) {
        console.error("Sync error:", err);
        return new Response(JSON.stringify({ error: "Sync failed", details: err.message }), {
          status: 500,
          headers: jsonHeaders
        });
      }
    }

    // === Chat (default) ===
    try {
      const bodyText = await request.text();
      console.log("Chat request body:", bodyText); // Log raw body
      let body;
      try {
        body = JSON.parse(bodyText);
      } catch (e) {
        return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
          status: 400,
          headers: jsonHeaders
        });
      }
      const timestamp = new Date().toISOString();
      const randomId = crypto.randomUUID();
      const key = `${timestamp}_${randomId}`;

      const simplified = {
        user: body.messages?.at(-2)?.content || "no user message",
        bot: body.messages?.at(-1)?.content || "no bot reply"
      };

      await env.CONVERSATIONS.put(key, JSON.stringify(simplified));

      const apiResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer sk-6008bfba03f94d01bc0dcab0e9569bb0',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      const text = await apiResponse.text();
      return new Response(text, {
        status: apiResponse.status,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });

    } catch (err) {
      console.error("Chat handler error:", err);
      return new Response(JSON.stringify({ error: "Internal server error", details: err.message }), {
        status: 500,
        headers: jsonHeaders
      });
    }
  }
};