// Demo backend: answers the site's API calls in the browser when no API_URL is set.
// It intercepts XMLHttpRequest (used by axios) and fetch for requests to the demo
// URL and keeps its data in localStorage, so bookings, cars and users survive page loads.
(function () {
  if (!window.DEMO_MODE) return;

  var BASE = window.API_URL;
  var KEY = "saqr-demo-db";
  var img = function (name) { return { secure_url: window.SITE_ROOT + "Assets/data/" + name }; };
  var uid = function () { return Math.random().toString(36).slice(2, 10); };

  function seed() {
    return {
      users: [
        { _id: "u-admin", userName: "Admin", email: "admin@saqr.demo", password: "Admin@123", role: "admin", phone: "0500000000", addresses: "Madinah", gender: "male", age: 35 },
        { _id: "u-1", userName: "Khalid", email: "user@saqr.demo", password: "User@1234", role: "user", phone: "0551234567", addresses: "Madinah", gender: "male", age: 28 },
      ],
      cat: [{ _id: "c1", name: "سيارات عائلية" }, { _id: "c2", name: "سيارات فاخرة" }],
      caten: [{ _id: "e1", name: "Family cars" }, { _id: "e2", name: "Luxury cars" }],
      cars: [
        { _id: "car1", name: "جي إم سي يوكن", capacity: 7, prices: 650, addresses: "عائلية", description: "سيارة عائلية واسعة مع سائق محترف، مناسبة للرحلات بين المدن.", categoryId: "c1", carImage: [img("p1.jpg")] },
        { _id: "car2", name: "تويوتا هايس", capacity: 12, prices: 500, addresses: "عائلية", description: "حافلة صغيرة للمجموعات والعائلات الكبيرة.", categoryId: "c1", carImage: [img("p2.jpg")] },
        { _id: "car3", name: "شيفروليه تاهو", capacity: 7, prices: 800, addresses: "فاخرة", description: "سيارة فاخرة لكبار الزوار ورحلات المطار.", categoryId: "c2", carImage: [img("p3.jpg")] },
        { _id: "car4", name: "GMC Yukon", capacity: 7, prices: 650, addresses: "Family", description: "Spacious family SUV with a professional driver for intercity trips.", categoryIden: "e1", carImage: [img("p1.jpg")] },
        { _id: "car5", name: "Toyota Hiace", capacity: 12, prices: 500, addresses: "Family", description: "Minibus for groups and large families.", categoryIden: "e1", carImage: [img("p2.jpg")] },
        { _id: "car6", name: "Chevrolet Tahoe", capacity: 7, prices: 800, addresses: "Luxury", description: "Premium SUV for VIP guests and airport transfers.", categoryIden: "e2", carImage: [img("p3.jpg")] },
      ],
      rents: [
        { _id: "r1", rentalCode: "SQ-1001", firstName: "Khalid", lastName: "", email: "user@saqr.demo", phone: "0551234567", car: "جي إم سي يوكن", Time: "09:00 AM", rentDate: "2026-11-02", backDate: "2026-11-04", startingPoint: "المدينة المنورة", arrivalPoint: "مكة المكرمة", price: 650, status: "confirmed", paymentType: "arrival", addedBy: "u-1" },
      ],
      messages: [
        { _id: "m1", name: "Sara", email: "sara@example.com", description: "هل يتوفر سائق يتحدث الإنجليزية؟" },
      ],
    };
  }

  var db;
  try { db = JSON.parse(localStorage.getItem(KEY)) || seed(); } catch (e) { db = seed(); }
  var save = function () { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} };

  function currentUser(headers) {
    var token = headers.token || localStorage.getItem("token") || "";
    var id = String(token).replace("demo-", "");
    return db.users.find(function (u) { return u._id === id; });
  }
  var publicUser = function (u) { var c = Object.assign({}, u); delete c.password; return c; };
  var isAdmin = function (u) { return u && (u.role === "admin" || u.role === "superAdmin"); };
  var denied = { err: "You are not authorized " };

  function readBody(body) {
    if (!body) return {};
    if (body instanceof FormData) {
      var out = {};
      body.forEach(function (value, key) {
        if (key === "carImage") (out.carImage = out.carImage || []).push(value);
        else out[key] = value;
      });
      return out;
    }
    try { return JSON.parse(body); } catch (e) { return {}; }
  }
  var imageFrom = function (file) { return file instanceof Blob ? { secure_url: URL.createObjectURL(file) } : img("p4.jpg"); };

  function carFromBody(b, car) {
    car = car || { _id: uid() };
    ["name", "capacity", "description", "addresses", "prices", "categoryId", "categoryIden"].forEach(function (k) {
      if (b[k] !== undefined && b[k] !== "") car[k] = b[k];
    });
    if (b.carImage && b.carImage.length) car.carImage = b.carImage.map(imageFrom);
    car.carImage = car.carImage || [img("p4.jpg")];
    return car;
  }

  function csv(rows, columns) {
    var esc = function (v) { return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"'; };
    return "﻿" + [columns.join(",")].concat(rows.map(function (r) { return columns.map(function (c) { return esc(r[c]); }).join(","); })).join("\n");
  }

  // [method, path, handler(params, body, user, query)] -> [status, data]
  var routes = [
    ["post", "/user/signUp", function (p, b) {
      if (db.users.some(function (u) { return u.email === b.email; })) return [409, { message: "email already exists" }];
      db.users.push(Object.assign({ _id: uid(), role: "user" }, b));
      return [201, { message: "user created successfully" }];
    }],
    ["post", "/user/logIn", function (p, b) {
      var u = db.users.find(function (x) { return x.email === b.email && x.password === b.password; });
      if (!u) return [200, { message: "wrong email or password" }];
      return [200, { message: "you logged in successfully", token: "demo-" + u._id, payload: { id: u._id, role: u.role } }];
    }],
    ["put", "/user/logout", function () { return [200, { message: "logout Successfully" }]; }],
    ["patch", "/user/forget_code", function () { return [200, "you can reset your password now"]; }],
    ["put", "/user/reset_password", function (p, b) {
      var u = db.users.find(function (x) { return x.email === b.email; });
      if (!u) return [404, { success: false, message: "user not found" }];
      u.password = b.password;
      return [200, { success: true }];
    }],
    ["get", "/user/loggedUserProfile", function (p, b, user) { return user ? [200, { User: publicUser(user) }] : [401, { message: "login first" }]; }],
    ["post", "/user/profilePic", function (p, b, user) {
      if (user && b.ProfilePicture) user.profileImage = imageFrom(b.ProfilePicture);
      return [200, { message: "Profile picture updated" }];
    }],
    ["get", "/user", function () { return [200, { user: db.users.map(publicUser) }]; }],
    ["delete", "/user/deleteUser/:id", function (p, b, user) {
      if (!isAdmin(user)) return [200, denied];
      db.users = db.users.filter(function (u) { return u._id !== p.id; });
      return [200, { message: "User deleted successfully" }];
    }],

    ["get", "/category", function (p, b, u, q) { return [200, { name: q.get("lang") === "en" ? db.caten : db.cat }]; }],
    ["get", "/category/all", function () { return [200, { cat: db.cat, caten: db.caten }]; }],
    ["post", "/category/addCategory", function (p, b) { db.cat.push({ _id: uid(), name: b.name }); return [201, { message: "Category created successfully" }]; }],
    ["post", "/category/addCategoryen", function (p, b) { db.caten.push({ _id: uid(), name: b.name }); return [201, { message: "Category created successfully" }]; }],
    ["delete", "/category/deleteCategory/:id", function (p, b, user) {
      if (!isAdmin(user)) return [200, denied];
      var keep = function (c) { return c._id !== p.id; };
      db.cat = db.cat.filter(keep);
      db.caten = db.caten.filter(keep);
      return [200, { message: "Category deleted successfully" }];
    }],

    ["get", "/car", function () { return [200, { cars: db.cars }]; }],
    ["get", "/car/carById/:id", function (p) { return [200, { car: db.cars.find(function (c) { return c._id === p.id; }) }]; }],
    ["get", "/car/carByCatId/:id", function (p) {
      return [200, { car: db.cars.filter(function (c) { return c.categoryId === p.id || c.categoryIden === p.id; }) }];
    }],
    ["post", "/car/addCar", function (p, b) { db.cars.push(carFromBody(b)); return [201, { message: "Car created successfully" }]; }],
    ["post", "/car/addcaren", function (p, b) { db.cars.push(carFromBody(b)); return [201, { message: "Car created successfully" }]; }],
    ["put", "/car/updateCar/:id", function (p, b) {
      var car = db.cars.find(function (c) { return c._id === p.id; });
      if (!car) return [404, { message: "Car not found" }];
      carFromBody(b, car);
      return [200, { message: "Car updated successfully" }];
    }],
    ["delete", "/car/deleteCar/:id", function (p, b, user) {
      if (!isAdmin(user)) return [200, { err: "You are not authorized" }];
      db.cars = db.cars.filter(function (c) { return c._id !== p.id; });
      return [200, { message: "Car deleted successfully" }];
    }],

    ["get", "/rent", function () { return [200, { rent: db.rents }]; }],
    ["get", "/rent/getCurrentuserRents", function (p, b, user) {
      return [200, { User: user ? db.rents.filter(function (r) { return r.addedBy === user._id; }) : [] }];
    }],
    ["post", "/rent/addRent", function (p, b, user) {
      var now = new Date();
      var rent = Object.assign({
        _id: uid(),
        rentalCode: "SQ-" + (1000 + db.rents.length + 1),
        lastName: "",
        Time: now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
        rentDate: now.toLocaleDateString("en-CA"),
        status: "pending",
        paymentType: "",
        addedBy: user ? user._id : null,
      }, b);
      db.rents.push(rent);
      return [201, { message: "Rent created successfully", rent: rent }];
    }],
    ["patch", "/rent/addPayment/:id", function (p, b) {
      var rent = db.rents.find(function (r) { return r._id === p.id; });
      if (rent) rent.paymentType = b.paymentType;
      return [200, { message: "Payment Added successfully" }];
    }],
    ["put", "/rent/updateRent/:id", function (p, b) {
      Object.assign(db.rents.find(function (r) { return r._id === p.id; }) || {}, b);
      return [200, { message: "Rent Updated successfully" }];
    }],
    ["delete", "/rent/deleteRent/:id", function (p, b, user) {
      if (!isAdmin(user)) return [200, denied];
      db.rents = db.rents.filter(function (r) { return r._id !== p.id; });
      return [200, { message: "Rent deleted successfully" }];
    }],
    ["get", "/rent/downloadData", function () {
      return [200, csv(db.rents, ["rentalCode", "firstName", "email", "phone", "car", "rentDate", "startingPoint", "arrivalPoint", "price", "status", "paymentType"]), "text/csv"];
    }],
    ["get", "/user/downloadUserData", function () {
      return [200, csv(db.users, ["userName", "email", "phone", "gender", "addresses", "age", "role"]), "text/csv"];
    }],

    ["get", "/message", function () { return [200, { messages: db.messages }]; }],
    ["post", "/message/addMessage", function (p, b) { db.messages.push(Object.assign({ _id: uid() }, b)); return [201, { message: "Message Sent successfully" }]; }],
    ["delete", "/message/deleteMessage/:id", function (p, b, user) {
      if (!isAdmin(user)) return [200, denied];
      db.messages = db.messages.filter(function (m) { return m._id !== p.id; });
      return [200, { message: "Message deleted successfully" }];
    }],
  ];

  function match(pattern, path) {
    var a = pattern.split("/"), b = path.split("/");
    if (a.length !== b.length) return null;
    var params = {};
    for (var i = 0; i < a.length; i++) {
      if (a[i].charAt(0) === ":") params[a[i].slice(1)] = decodeURIComponent(b[i]);
      else if (a[i] !== b[i]) return null;
    }
    return params;
  }

  function handle(method, url, body, headers) {
    var u = new URL(url);
    var path = u.pathname.replace(/\/$/, "");
    for (var i = 0; i < routes.length; i++) {
      var r = routes[i];
      var params = r[0] === method.toLowerCase() && match(r[1], path);
      if (!params) continue;
      var result = r[2](params, readBody(body), currentUser(headers), u.searchParams);
      save();
      return result;
    }
    return [404, { message: "Demo API: no route for " + method.toUpperCase() + " " + path }];
  }

  var isDemo = function (url) { return String(url).indexOf(BASE) === 0; };

  // XMLHttpRequest, used by axios in the browser.
  var RealXHR = window.XMLHttpRequest;
  function DemoXHR() {
    var xhr = new RealXHR();
    var demo = null;
    var state = { readyState: 0, status: 0, responseText: "", headers: {} };
    var realOpen = xhr.open, realSend = xhr.send, realSetHeader = xhr.setRequestHeader;

    xhr.open = function (method, url) {
      if (isDemo(url)) { demo = { method: method, url: url }; return; }
      return realOpen.apply(xhr, arguments);
    };
    xhr.setRequestHeader = function (name, value) {
      if (demo) { state.headers[name] = value; return; }
      return realSetHeader.apply(xhr, arguments);
    };
    xhr.send = function (body) {
      if (!demo) return realSend.apply(xhr, arguments);
      setTimeout(function () {
        var res = handle(demo.method, demo.url, body, state.headers);
        state.readyState = 4;
        state.status = res[0];
        state.responseText = typeof res[1] === "string" ? res[1] : JSON.stringify(res[1]);
        state.contentType = res[2] || "application/json";
        ["onreadystatechange", "onload", "onloadend"].forEach(function (h) { if (typeof xhr[h] === "function") xhr[h](); });
      }, 200);
    };
    var fake = function (prop, fallback) {
      Object.defineProperty(xhr, prop, { get: function () { return demo ? fallback() : RealXHR.prototype.__lookupGetter__(prop).call(xhr); } });
    };
    fake("readyState", function () { return state.readyState; });
    fake("status", function () { return state.status; });
    fake("statusText", function () { return String(state.status); });
    fake("responseText", function () { return state.responseText; });
    fake("response", function () { return state.responseText; });
    fake("responseURL", function () { return demo.url; });
    var realAllHeaders = xhr.getAllResponseHeaders;
    xhr.getAllResponseHeaders = function () {
      return demo ? "content-type: " + state.contentType + "\r\n" : realAllHeaders.call(xhr);
    };
    return xhr;
  }
  DemoXHR.UNSENT = 0; DemoXHR.OPENED = 1; DemoXHR.HEADERS_RECEIVED = 2; DemoXHR.LOADING = 3; DemoXHR.DONE = 4;
  window.XMLHttpRequest = DemoXHR;

  // fetch, used for the Excel downloads on the dashboard.
  var realFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    init = init || {};
    var url = typeof input === "string" ? input : input.url;
    if (!isDemo(url)) return realFetch(input, init);
    var res = handle(init.method || "GET", url, init.body, init.headers || {});
    var text = typeof res[1] === "string" ? res[1] : JSON.stringify(res[1]);
    return Promise.resolve(new Response(text, { status: res[0], headers: { "Content-Type": res[2] || "application/json" } }));
  };

  // Small banner so visitors know they are looking at sample data.
  document.addEventListener("DOMContentLoaded", function () {
    var bar = document.createElement("div");
    bar.textContent = "وضع تجريبي — بيانات وهمية. دخول الأدمن: admin@saqr.demo / Admin@123 — دخول العميل: user@saqr.demo / User@1234";
    bar.style.cssText = "position:fixed;bottom:0;left:0;right:0;z-index:9999;background:#1f2937;color:#fff;font:13px/1.6 sans-serif;text-align:center;padding:4px 8px;direction:rtl";
    document.body.appendChild(bar);
  });
})();
