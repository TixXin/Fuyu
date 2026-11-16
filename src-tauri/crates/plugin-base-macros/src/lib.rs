use proc_macro::TokenStream;
use proc_macro2::TokenStream as Tokens;
use quote::{format_ident, quote};
use syn::{
    parse::{Parse, ParseStream},
    parse_macro_input,
    punctuated::Punctuated,
    Error, FnArg, GenericArgument, Ident, ItemFn, LitInt, LitStr, Pat, PathArguments, ReturnType, Token, Type,
};

const NO_APP_HANDLE: &str = "a host service cannot take an AppHandle, injected or not: it is registered statically, so the AppHandle and the tauri runtime would be linked into every Rust test binary, and on Windows those binaries then fail to start (0xc0000139). For the data folder use crate::home_dir::current(); see docs/architecture/plugins/v3-services.md, \"Rust 那条路\"";

struct Args {
    name: LitStr,
    timeout_ms: Option<LitInt>,
    inject: Vec<Ident>,
}

fn valid_name(name: &str) -> bool {
    !name.is_empty()
        && name.split('.').all(|part| {
            let mut chars = part.chars();
            chars.next().is_some_and(|first| first.is_ascii_lowercase()) && chars.all(|char| char.is_ascii_alphanumeric() || char == '-')
        })
}

impl Parse for Args {
    fn parse(input: ParseStream) -> syn::Result<Self> {
        let name: LitStr = input.parse()?;
        if !valid_name(&name.value()) {
            return Err(Error::new(name.span(), "a host service is named like \"app.version\" or \"translator.translate\": lowercase first letters, parts joined by dots"));
        }
        let mut args = Self { name, timeout_ms: None, inject: Vec::new() };
        while !input.is_empty() {
            input.parse::<Token![,]>()?;
            if input.is_empty() {
                break;
            }
            let key: Ident = input.parse()?;
            if key == "timeout_ms" {
                input.parse::<Token![=]>()?;
                args.timeout_ms = Some(input.parse()?);
            } else if key == "inject" {
                let content;
                syn::parenthesized!(content in input);
                args.inject = Punctuated::<Ident, Token![,]>::parse_terminated(&content)?.into_iter().collect();
                if let Some(app) = args.inject.iter().find(|name| *name == "app") {
                    return Err(Error::new(app.span(), NO_APP_HANDLE));
                }
            } else {
                return Err(Error::new(key.span(), "expected `timeout_ms = <milliseconds>` or `inject(<parameter>, …)`"));
            }
        }
        Ok(args)
    }
}

enum Param {
    Call,
    Inject { ident: Ident, ty: Type },
    Json { ident: Ident, key: String, ty: Type, optional: bool },
}

fn last_segment(ty: &Type) -> Option<&syn::PathSegment> {
    match ty {
        Type::Path(path) if path.qself.is_none() => path.path.segments.last(),
        Type::Group(group) => last_segment(&group.elem),
        _ => None,
    }
}

fn is_named(ty: &Type, name: &str) -> bool {
    last_segment(ty).is_some_and(|segment| segment.ident == name)
}

fn first_type_argument(ty: &Type) -> Option<&Type> {
    let PathArguments::AngleBracketed(arguments) = &last_segment(ty)?.arguments else { return None };
    arguments.args.iter().find_map(|argument| match argument {
        GenericArgument::Type(ty) => Some(ty),
        _ => None,
    })
}

fn camel_case(name: &str) -> String {
    let mut out = String::new();
    let mut upper = false;
    for char in name.trim_start_matches("r#").trim_start_matches('_').chars() {
        if char == '_' {
            upper = !out.is_empty();
        } else if upper {
            out.extend(char.to_uppercase());
            upper = false;
        } else {
            out.push(char);
        }
    }
    out
}

fn params(function: &ItemFn, inject: &[Ident]) -> syn::Result<Vec<Param>> {
    let mut found = Vec::new();
    for input in &function.sig.inputs {
        let FnArg::Typed(typed) = input else {
            return Err(Error::new_spanned(input, "#[host_service] goes on a free function, not a method"));
        };
        let Pat::Ident(pattern) = typed.pat.as_ref() else {
            return Err(Error::new_spanned(&typed.pat, "#[host_service] needs plain parameter names"));
        };
        let ident = pattern.ident.clone();
        let ty = typed.ty.as_ref().clone();
        if is_named(&ty, "AppHandle") || matches!(&ty, Type::Reference(reference) if is_named(&reference.elem, "AppHandle")) {
            return Err(Error::new_spanned(&typed.ty, NO_APP_HANDLE));
        }
        if let Type::Reference(reference) = &ty {
            if is_named(&reference.elem, "Call") {
                found.push(Param::Call);
                continue;
            }
            return Err(Error::new_spanned(&typed.ty, "parameters of a host service are decoded from JSON, so they must be owned (String, not &str); only &Call may be borrowed"));
        }
        if inject.contains(&ident) {
            found.push(Param::Inject { ident, ty });
        } else {
            found.push(Param::Json { key: camel_case(&ident.to_string()), optional: is_named(&ty, "Option"), ident, ty });
        }
    }
    for name in inject {
        if !found.iter().any(|param| matches!(param, Param::Inject { ident, .. } if ident == name)) {
            return Err(Error::new_spanned(name, "inject names a parameter this function does not have"));
        }
    }
    Ok(found)
}

enum Output {
    Unit,
    Plain(Type),
    Result(Type),
}

fn output(function: &ItemFn) -> syn::Result<Output> {
    let ReturnType::Type(_, ty) = &function.sig.output else { return Ok(Output::Unit) };
    if is_named(ty, "Result") {
        let ok = first_type_argument(ty).ok_or_else(|| Error::new_spanned(ty, "#[host_service] needs Result<T, E> spelled out with both types"))?;
        return Ok(Output::Result(ok.clone()));
    }
    Ok(Output::Plain(ty.as_ref().clone()))
}

fn expand(args: Args, function: ItemFn) -> syn::Result<Tokens> {
    if !function.sig.generics.params.is_empty() {
        return Err(Error::new_spanned(&function.sig.generics, "a host service cannot be generic"));
    }
    let name = &args.name;
    let fn_ident = &function.sig.ident;
    let handler = format_ident!("__host_service_{}", fn_ident);
    let types = format_ident!("__host_service_types_{}", fn_ident);
    let params = params(&function, &args.inject)?;
    let output = output(&function)?;
    let timeout = match &args.timeout_ms {
        Some(ms) => quote!(::core::option::Option::Some(#ms)),
        None => quote!(::core::option::Option::None),
    };
    let decode = params.iter().map(|param| match param {
        Param::Json { ident, key, ty, .. } => quote!(let #ident: #ty = ::plugin_base::__private::field(&mut __object, #key, #name)?;),
        Param::Inject { ident, ty } => quote!(let #ident: #ty = __call.state::<#ty>()?;),
        Param::Call => quote!(),
    });
    let arguments = params.iter().map(|param| match param {
        Param::Json { ident, .. } | Param::Inject { ident, .. } => quote!(#ident),
        Param::Call => quote!(__call),
    });
    let encode = match &output {
        Output::Unit => quote!({
            let () = __output;
            ::core::result::Result::Ok(::plugin_base::__private::Value::Null)
        }),
        Output::Plain(_) => quote!(::plugin_base::__private::encode(__output, #name)),
        Output::Result(_) => quote!(match __output {
            ::core::result::Result::Ok(value) => ::plugin_base::__private::encode(value, #name),
            ::core::result::Result::Err(error) => ::core::result::Result::Err(::plugin_base::ServiceFailure::into_serve_error(error)),
        }),
    };
    let run = if function.sig.asyncness.is_some() {
        quote!(__call.block_on(::std::boxed::Box::pin(async move {
            let __output = #fn_ident(#(#arguments),*).await;
            #encode
        })))
    } else {
        quote!({
            let __output = #fn_ident(#(#arguments),*);
            #encode
        })
    };
    let ts_params = params.iter().filter_map(|param| match param {
        Param::Json { key, ty, optional, .. } => Some(quote!(__types.param::<#ty>(#key, #optional);)),
        _ => None,
    });
    let ts_result = match &output {
        Output::Unit => quote!(__types.nothing();),
        Output::Plain(ty) | Output::Result(ty) => quote!(__types.result::<#ty>();),
    };
    Ok(quote! {
        #function

        #[doc(hidden)]
        #[allow(non_snake_case, clippy::needless_question_mark)]
        fn #handler(
            __params: ::plugin_base::__private::Value,
            __call: &::plugin_base::Call,
        ) -> ::core::result::Result<::plugin_base::__private::Value, ::plugin_base::ServeError> {
            #[allow(unused_mut, unused_variables)]
            let mut __object = ::plugin_base::__private::params_object(__params, #name)?;
            #(#decode)*
            #run
        }

        ::plugin_base::__private::inventory::submit! {
            ::plugin_base::Registration::new(
                #name,
                #timeout,
                #handler,
                ::core::concat!(::core::module_path!(), "::", ::core::stringify!(#fn_ident)),
                ::core::file!(),
                ::core::line!(),
            )
        }

        #[cfg(test)]
        #[doc(hidden)]
        #[allow(non_snake_case)]
        fn #types() -> ::plugin_base::ts::MethodTypes {
            let mut __types = ::plugin_base::ts::MethodTypes::new(#name);
            #(#ts_params)*
            #ts_result
            __types
        }

        #[cfg(test)]
        ::plugin_base::__private::inventory::submit! {
            ::plugin_base::ts::TypesRegistration::new(#types)
        }
    })
}

#[proc_macro_attribute]
pub fn host_service(attr: TokenStream, item: TokenStream) -> TokenStream {
    let args = parse_macro_input!(attr as Args);
    let function = parse_macro_input!(item as ItemFn);
    expand(args, function).unwrap_or_else(Error::into_compile_error).into()
}

#[cfg(test)]
mod tests;
