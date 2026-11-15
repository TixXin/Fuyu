use std::{any::TypeId, collections::BTreeMap, collections::HashSet};

use ts_rs::{Config, TypeVisitor, TS};

fn config() -> Config {
    Config::default().with_large_int("number")
}

pub struct MethodTypes {
    pub name: &'static str,
    pub params: Vec<(String, String, bool)>,
    pub result: String,
    pub declarations: BTreeMap<String, String>,
}

struct Collect<'a> {
    config: &'a Config,
    seen: HashSet<TypeId>,
    declarations: &'a mut BTreeMap<String, String>,
}

impl TypeVisitor for Collect<'_> {
    fn visit<T: TS + 'static + ?Sized>(&mut self) {
        if !self.seen.insert(TypeId::of::<T>()) {
            return;
        }
        if T::output_path().is_some() {
            self.declarations.insert(T::ident(self.config), T::decl(self.config));
        }
        T::visit_dependencies(self);
    }
}

impl MethodTypes {
    pub fn new(name: &'static str) -> Self {
        Self { name, params: Vec::new(), result: "null".into(), declarations: BTreeMap::new() }
    }

    fn collect<T: TS + 'static + ?Sized>(&mut self) {
        let config = config();
        Collect { config: &config, seen: HashSet::new(), declarations: &mut self.declarations }.visit::<T>();
    }

    pub fn param<T: TS + 'static + ?Sized>(&mut self, key: &str, optional: bool) {
        self.params.push((key.to_owned(), T::name(&config()), optional));
        self.collect::<T>();
    }

    pub fn result<T: TS + 'static + ?Sized>(&mut self) {
        self.result = T::name(&config());
        self.collect::<T>();
    }

    pub fn nothing(&mut self) {
        self.result = "null".into();
    }

    pub fn params_type(&self) -> String {
        if self.params.is_empty() {
            return "Record<string, never> | null".into();
        }
        let fields: Vec<String> = self.params.iter().map(|(key, ty, optional)| format!("{key}{}: {ty}", if *optional { "?" } else { "" })).collect();
        format!("{{ {} }}", fields.join("; "))
    }
}

pub struct TypesRegistration {
    pub describe: fn() -> MethodTypes,
}

impl TypesRegistration {
    pub const fn new(describe: fn() -> MethodTypes) -> Self {
        Self { describe }
    }
}

inventory::collect!(TypesRegistration);

pub fn described() -> Vec<MethodTypes> {
    let mut methods: Vec<MethodTypes> = inventory::iter::<TypesRegistration>.into_iter().map(|registration| (registration.describe)()).collect();
    methods.sort_by_key(|method| method.name);
    methods
}

pub fn declarations(methods: &[MethodTypes]) -> String {
    let mut types: BTreeMap<&str, &str> = BTreeMap::new();
    for method in methods {
        for (name, declaration) in &method.declarations {
            types.insert(name, declaration);
        }
    }
    let mut out = String::new();
    for declaration in types.values() {
        out.push_str("export ");
        out.push_str(declaration);
        out.push_str("\n\n");
    }
    out.push_str("export type RustMethods = {\n");
    for method in methods {
        out.push_str(&format!("  {:?}: {{ params: {}; result: {} }};\n", method.name, method.params_type(), method.result));
    }
    out.push_str("};\n");
    out
}

pub fn method_list(methods: &[MethodTypes]) -> String {
    let names: Vec<String> = methods.iter().map(|method| format!("  {:?},\n", method.name)).collect();
    format!("export const RUST_METHODS = Object.freeze([\n{}]);\n", names.concat())
}

pub fn typescript(methods: &[MethodTypes]) -> (String, String) {
    let names: Vec<String> = methods.iter().map(|method| format!("{:?}", method.name)).collect();
    let declarations = format!("{}\nexport declare const RUST_METHODS: readonly [{}];\n", declarations(methods), names.join(", "));
    (declarations, method_list(methods))
}
