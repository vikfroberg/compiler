import test from "ava";

const tNamed = name => ({
  type: "Type",
  nodeType: "Named",
  name: name,
});

const tFunc = (from, to) => {
  return {
    type: "Type",
    nodeType: "Function",
    from: from,
    to: to,
  };
};

const tVar = name => ({
  type: "Type",
  nodeType: "Var",
  name: name,
});

// --

const fn = (param, body) => ({
  type: "Expression",
  nodeType: "Function",
  param: param,
  body: body,
});

const call = (func, arg) => ({
  type: "Expression",
  nodeType: "Call",
  func: func,
  arg: arg,
});

const v = name => ({
  type: "Expression",
  nodeType: "Var",
  name: name,
});

const int = value => ({
  type: "Expression",
  nodeType: "Int",
  value: value,
});

const str = value => ({
  type: "Expression",
  nodeType: "String",
  value: value,
});

let i = 0;

function infer(context, expression) {
  switch (expression.nodeType) {
    case "Int": {
      return [tNamed("Int"), {}];
    }
    case "String": {
      return [tNamed("String"), {}];
    }
    case "Var": {
      if (context.env[expression.name]) {
        return [context.env[expression.name], {}];
      } else {
        throw new TypeError(`Unbound var ${expression.name}`);
      }
    }
    case "Function": {
      const paramType = tVar("T" + i++);
      const contextWithParam = addToContext(
        context,
        expression.param,
        paramType,
      );
      const [bodyType, bodySubstitution] = infer(
        contextWithParam,
        expression.body,
      );
      return [
        tFunc(applySubstToType(bodySubstitution, paramType), bodyType),
        bodySubstitution,
      ];
    }
    case "Call": {
      const [funcType, s1] = infer(context, expression.func);
      const [argType, s2] = infer(applySubstToCtx(s1, context), expression.arg);
      const newVar = tVar("T" + i++);
      const s3 = composeSubst(s1, s2);
      const s4 = unify(
        {
          nodeType: "Function",
          from: argType,
          to: newVar,
        },
        funcType,
      );
      const funcType1 = applySubstToType(s4, funcType);
      const s5 = composeSubst(s3, s4);
      const s6 = unify(applySubstToType(s5, funcType1.from), argType);
      const resultSubst = composeSubst(s5, s6);
      return [applySubstToType(resultSubst, funcType1.to), resultSubst];
      // const [funcType, funcSubstitution] = infer(context, expression.func);
      // const [argType, argSubstitution] = infer(
      //   applySubstToCtx(funcSubstitution, context),
      //   expression.arg,
      // );

      // const returnType = tVar("T" + i++);
      // const substitution = unify(tFunc(argType, returnType), funcType);
      // const inferedFuncType = applySubstToType(substitution, funcType);

      // const substitution2 = unify(
      //   applySubstToType(substitution, inferedFuncType.from),
      //   argType,
      // );
      // const resultSubstitution = composeSubst(substitution, substitution2);
      // return [
      //   applySubstToType(resultSubstitution, inferedFuncType.to),
      //   resultSubstitution,
      // ];
    }
    default: {
      throw "Not implemented";
    }
  }
}

function trace(tag, x) {
  console.log(tag, JSON.stringify(x, null, 2));
  return x;
}

function applySubstToCtx(subst, ctx) {
  const newContext = {
    ...ctx,
    env: {
      ...ctx.env,
    },
  };
  for (const name in newContext.env) {
    const t = newContext.env[name];
    newContext.env[name] = applySubstToType(subst, t);
  }
  return newContext;
}

function applySubstToType(subst, type) {
  switch (type.nodeType) {
    case "Named":
      return type;
    case "Var":
      if (subst[type.name]) {
        return subst[type.name];
      } else {
        return type;
      }
    case "Function":
      return {
        nodeType: "Function",
        from: applySubstToType(subst, type.from),
        to: applySubstToType(subst, type.to),
      };
  }
}

function addToContext(context, name, typeVar) {
  return { ...context, env: { ...context.env, [name]: typeVar } };
}

function unify(t1, t2) {
  if (
    t1.nodeType === "Named" &&
    t2.nodeType === "Named" &&
    t2.name === t1.name
  ) {
    return {};
  } else if (t1.nodeType === "Var") {
    return varBind(t1.name, t2);
  } else if (t2.nodeType === "Var") {
    return varBind(t2.name, t1);
  } else if (t1.nodeType === "Function" && t2.nodeType === "Function") {
    const s1 = unify(t1.from, t2.from);
    const s2 = unify(applySubstToType(s1, t1.to), applySubstToType(s1, t2.to));
    return composeSubst(s1, s2);
  } else {
    throw new TypeError(
      `Expected ${typeToString(t2)} but got ${typeToString(t1)}`,
    );
  }
}

function composeSubst(s1, s2) {
  const result = {};
  for (const k in s2) {
    const type = s2[k];
    result[k] = applySubstToType(s1, type);
  }
  return { ...s1, ...result };
}

function varBind(name, t) {
  if (t.nodeType === "Var" && t.name === name) {
    return {};
  } else {
    const subst = { [name]: t };
    return subst;
  }
}

function typeToString(type) {
  return type.name;
}

test("int", t => {
  t.deepEqual(infer({}, int(1))[0], tNamed("Int"));
});

test("string", t => {
  t.deepEqual(infer({}, str("Sanna"))[0], tNamed("String"));
});

test("var", t => {
  t.deepEqual(
    infer({ env: { False: tNamed("Bool") } }, v("False"))[0],
    tNamed("Bool"),
  );
});

test("call good", t => {
  t.deepEqual(
    infer(
      {
        next: 0,
        env: { inc: tFunc(tNamed("Int"), tNamed("Int")) },
      },
      call(v("inc"), int(5)),
    )[0],
    tNamed("Int"),
  );
});

test("call bad", t => {
  const error = t.throws(() => {
    infer(
      {
        next: 0,
        env: { inc: tFunc(tNamed("Int"), tNamed("Int")) },
      },
      call(v("inc"), str(5)),
    );
  });
});

test("call good curry", t => {
  t.deepEqual(
    infer(
      {
        next: 0,
        env: {
          add: tFunc(tNamed("Int"), tFunc(tNamed("Int"), tNamed("Int"))),
        },
      },
      call(call(v("add"), int(5)), int(5)),
    )[0],
    tNamed("Int"),
  );
});

test("call bad curry 1", t => {
  const error = t.throws(() => {
    infer(
      {
        next: 0,
        env: {
          add: tFunc(tNamed("Int"), tFunc(tNamed("Int"), tNamed("Int"))),
        },
      },
      call(call(v("add"), str("Sanna")), int(5)),
    );
  });
});

test("call bad curry 2", t => {
  const error = t.throws(() => {
    infer(
      {
        next: 0,
        env: {
          add: tFunc(tNamed("Int"), tFunc(tNamed("Int"), tNamed("Int"))),
        },
      },
      call(call(v("add"), int(1)), str("Sanna")),
    );
  });
});

test("call bad curry both", t => {
  const error = t.throws(() => {
    infer(
      {
        next: 0,
        env: {
          add: tFunc(tNamed("Int"), tFunc(tNamed("Int"), tNamed("Int"))),
        },
      },
      call(call(v("add"), str("Sanna")), str("Sanna")),
    );
  });
});

test.only("call good type var", t => {
  const inc = fn("a", call(call(v("add"), v("a")), int(1)));
  t.deepEqual(
    infer(
      {
        next: 0,
        env: {
          add: tFunc(tNamed("Int"), tFunc(tNamed("Int"), tNamed("Int"))),
        },
      },
      call(inc, int(5)),
    )[0],
    tNamed("Int"),
  );
});
