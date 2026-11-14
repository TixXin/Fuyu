use serde_json::{json, Map, Value};

pub(super) const MAX_PER_PLUGIN: usize = 8;
pub(super) const MAX_TOTAL: usize = 24;
pub(super) const MIN_SIDE: i32 = 48;
pub(super) const MAX_UPDATES_PER_SECOND: usize = 30;
const MAX_ID_CHARS: usize = 64;
const MAX_TITLE_CHARS: usize = 80;
pub(super) const TITLE_SUFFIX: &str = " · 浮屿";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum Kind {
    Panel,
    Widget,
}

impl Kind {
    pub fn name(self) -> &'static str {
        match self {
            Kind::Panel => "panel",
            Kind::Widget => "widget",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum Layer {
    Desktop,
    Normal,
    Topmost,
}

impl Layer {
    pub fn name(self) -> &'static str {
        match self {
            Layer::Desktop => "desktop",
            Layer::Normal => "normal",
            Layer::Topmost => "topmost",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub(super) struct Rect {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

impl Rect {
    pub fn to_json(self) -> Value {
        json!({ "x": self.x, "y": self.y, "width": self.width, "height": self.height })
    }

    fn overlap(self, other: Rect) -> (i32, i32) {
        let width = (self.x + self.width).min(other.x + other.width) - self.x.max(other.x);
        let height = (self.y + self.height).min(other.y + other.height) - self.y.max(other.y);
        (width.max(0), height.max(0))
    }

    fn center(self) -> (i64, i64) {
        (i64::from(self.x) + i64::from(self.width) / 2, i64::from(self.y) + i64::from(self.height) / 2)
    }
}

#[derive(Debug, Clone, PartialEq)]
pub(super) struct ScreenArea {
    pub id: String,
    pub work_area: Rect,
    pub bounds: Rect,
    pub scale: f64,
    pub primary: bool,
}

impl ScreenArea {
    pub fn to_json(&self) -> Value {
        json!({ "id": self.id, "bounds": self.bounds.to_json(), "workArea": self.work_area.to_json(), "scale": self.scale, "primary": self.primary })
    }
}

#[derive(Debug, Clone, PartialEq)]
pub(super) struct Options {
    pub layer: Layer,
    pub opacity: f64,
    pub title: Option<String>,
    pub resizable: bool,
    pub min_size: (i32, i32),
    pub max_size: Option<(i32, i32)>,
    pub click_through: bool,
    pub hide_on_blur: bool,
}

impl Options {
    pub fn defaults(kind: Kind) -> Self {
        Self {
            layer: if kind == Kind::Panel { Layer::Topmost } else { Layer::Desktop },
            opacity: 1.0,
            title: None,
            resizable: false,
            min_size: (MIN_SIDE, MIN_SIDE),
            max_size: None,
            click_through: false,
            hide_on_blur: false,
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub(super) struct Placement {
    pub bounds: Option<Rect>,
    pub screen: Option<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub(super) struct CreateRequest {
    pub id: String,
    pub kind: Kind,
    pub entry: String,
    pub placement: Placement,
    pub options: Options,
    pub visible: bool,
}

#[derive(Debug, Clone, PartialEq, Default)]
pub(super) struct UpdateRequest {
    pub id: String,
    pub placement: Option<Placement>,
    pub fields: Map<String, Value>,
}

type Fail = (u16, String);

fn bad(message: impl Into<String>) -> Fail {
    (400, message.into())
}

pub(super) fn parse_id(params: &Value) -> Result<String, Fail> {
    let id = params.get("id").and_then(Value::as_str).ok_or_else(|| bad("\"id\" is required."))?;
    let valid = (1..=MAX_ID_CHARS).contains(&id.chars().count()) && id.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'));
    if valid {
        Ok(id.to_string())
    } else {
        Err(bad(format!("\"id\" must be 1-{MAX_ID_CHARS} letters, digits, '-', '_' or '.'.")))
    }
}

fn parse_entry(params: &Value) -> Result<String, Fail> {
    let entry = params.get("entry").and_then(Value::as_str).ok_or_else(|| bad("\"entry\" is required: an HTML file in the plugin folder."))?;
    let lower = entry.to_ascii_lowercase();
    let clean = !entry.is_empty()
        && !entry.starts_with('/')
        && !entry.contains(['\\', ':', '?', '#', '\0'])
        && entry.split('/').all(|part| !part.is_empty() && part != "." && part != "..");
    if clean && (lower.ends_with(".html") || lower.ends_with(".htm")) {
        Ok(entry.to_string())
    } else {
        Err(bad("\"entry\" must be a relative path to an .html file in the plugin folder."))
    }
}

fn int(value: &Value, name: &str) -> Result<i32, Fail> {
    value
        .as_f64()
        .filter(|number| number.is_finite() && (-100_000.0..=100_000.0).contains(number))
        .map(|number| number.round() as i32)
        .ok_or_else(|| bad(format!("\"{name}\" must be a number of pixels.")))
}

fn parse_rect(value: &Value) -> Result<Rect, Fail> {
    let field = |name: &str| value.get(name).ok_or_else(|| bad(format!("\"bounds.{name}\" is required."))).and_then(|v| int(v, &format!("bounds.{name}")));
    Ok(Rect { x: field("x")?, y: field("y")?, width: field("width")?, height: field("height")? })
}

fn parse_size(value: &Value, name: &str) -> Result<(i32, i32), Fail> {
    let width = value.get("width").ok_or_else(|| bad(format!("\"{name}.width\" is required."))).and_then(|v| int(v, name))?;
    let height = value.get("height").ok_or_else(|| bad(format!("\"{name}.height\" is required."))).and_then(|v| int(v, name))?;
    Ok((width.max(MIN_SIDE), height.max(MIN_SIDE)))
}

fn parse_bool(value: &Value, name: &str) -> Result<bool, Fail> {
    value.as_bool().ok_or_else(|| bad(format!("\"{name}\" must be true or false.")))
}

fn parse_placement(params: &Value) -> Result<Option<Placement>, Fail> {
    let bounds = match params.get("bounds") {
        None | Some(Value::Null) => None,
        Some(value) => Some(parse_rect(value)?),
    };
    let screen = match params.get("screen") {
        None | Some(Value::Null) => None,
        Some(Value::String(screen)) => Some(screen.clone()),
        Some(_) => return Err(bad("\"screen\" must be an id from screens.list.")),
    };
    Ok((bounds.is_some() || screen.is_some()).then_some(Placement { bounds, screen }))
}

pub(super) fn apply_options(options: &mut Options, kind: Kind, params: &Value) -> Result<(), Fail> {
    if let Some(layer) = params.get("layer").filter(|value| !value.is_null()) {
        options.layer = match layer.as_str() {
            Some("desktop") => Layer::Desktop,
            Some("normal") => Layer::Normal,
            Some("topmost") => Layer::Topmost,
            _ => return Err(bad("\"layer\" must be \"desktop\", \"normal\" or \"topmost\".")),
        };
    }
    if let Some(opacity) = params.get("opacity").filter(|value| !value.is_null()) {
        options.opacity = opacity
            .as_f64()
            .filter(|value| (0.2..=1.0).contains(value))
            .ok_or_else(|| bad("\"opacity\" must be between 0.2 and 1."))?;
    }
    if let Some(title) = params.get("title").filter(|value| !value.is_null()) {
        let title = title.as_str().map(str::trim).filter(|title| (1..=MAX_TITLE_CHARS).contains(&title.chars().count()));
        options.title = Some(title.ok_or_else(|| bad(format!("\"title\" must be 1-{MAX_TITLE_CHARS} characters.")))?.to_string());
    }
    if let Some(value) = params.get("resizable").filter(|value| !value.is_null()) {
        options.resizable = parse_bool(value, "resizable")?;
    }
    if let Some(value) = params.get("minSize").filter(|value| !value.is_null()) {
        options.min_size = parse_size(value, "minSize")?;
    }
    if let Some(value) = params.get("maxSize") {
        options.max_size = if value.is_null() { None } else { Some(parse_size(value, "maxSize")?) };
    }
    if let Some(value) = params.get("clickThrough").filter(|value| !value.is_null()) {
        options.click_through = parse_bool(value, "clickThrough")?;
    }
    if let Some(value) = params.get("hideOnBlur").filter(|value| !value.is_null()) {
        let hide = parse_bool(value, "hideOnBlur")?;
        if hide && kind == Kind::Widget {
            return Err(bad("\"hideOnBlur\" is only for panels: widgets never take the focus."));
        }
        options.hide_on_blur = hide;
    }
    if let Some((max_width, max_height)) = options.max_size {
        if max_width < options.min_size.0 || max_height < options.min_size.1 {
            return Err(bad("\"maxSize\" must not be smaller than \"minSize\"."));
        }
    }
    Ok(())
}

pub(super) fn parse_create(params: &Value) -> Result<CreateRequest, Fail> {
    let id = parse_id(params)?;
    let kind = match params.get("kind").and_then(Value::as_str) {
        Some("panel") => Kind::Panel,
        Some("widget") => Kind::Widget,
        _ => return Err(bad("\"kind\" must be \"panel\" or \"widget\".")),
    };
    let entry = parse_entry(params)?;
    let placement = parse_placement(params)?.unwrap_or(Placement { bounds: None, screen: None });
    let mut options = Options::defaults(kind);
    apply_options(&mut options, kind, params)?;
    let visible = match params.get("visible") {
        None | Some(Value::Null) => true,
        Some(value) => parse_bool(value, "visible")?,
    };
    Ok(CreateRequest { id, kind, entry, placement, options, visible })
}

pub(super) fn parse_update(params: &Value) -> Result<UpdateRequest, Fail> {
    let id = parse_id(params)?;
    let object = params.as_object().ok_or_else(|| bad("Expected an object."))?;
    for fixed in ["kind", "entry"] {
        if object.contains_key(fixed) {
            return Err(bad(format!("\"{fixed}\" cannot change after window.create; close the window and create it again.")));
        }
    }
    let placement = parse_placement(params)?;
    let mut fields = object.clone();
    for taken in ["id", "bounds", "screen"] {
        fields.remove(taken);
    }
    if let Some(unknown) = fields.keys().find(|key| !["layer", "opacity", "title", "resizable", "minSize", "maxSize", "clickThrough", "hideOnBlur"].contains(&key.as_str())) {
        return Err(bad(format!("Unknown window property \"{unknown}\".")));
    }
    Ok(UpdateRequest { id, placement, fields })
}

pub(super) fn default_size(kind: Kind, scale: f64) -> (i32, i32) {
    let (width, height) = if kind == Kind::Panel { (640.0, 420.0) } else { (240.0, 160.0) };
    ((width * scale).round() as i32, (height * scale).round() as i32)
}

pub(super) fn pick_screen<'a>(screens: &'a [ScreenArea], wanted: Option<&str>, near: Option<Rect>) -> Option<&'a ScreenArea> {
    if let Some(screen) = wanted.and_then(|wanted| screens.iter().find(|screen| screen.id == wanted)) {
        return Some(screen);
    }
    if let Some(near) = near {
        let best = screens.iter().max_by_key(|screen| {
            let (width, height) = near.overlap(screen.bounds);
            i64::from(width) * i64::from(height)
        });
        if best.is_some_and(|screen| near.overlap(screen.bounds) != (0, 0)) {
            return best;
        }
        let (cx, cy) = near.center();
        return screens.iter().min_by_key(|screen| {
            let (sx, sy) = screen.work_area.center();
            (sx - cx).pow(2) + (sy - cy).pow(2)
        });
    }
    screens.iter().find(|screen| screen.primary).or_else(|| screens.first())
}

pub(super) fn fit(rect: Rect, min: (i32, i32), max: Option<(i32, i32)>, screens: &[ScreenArea], wanted_screen: Option<&str>) -> Rect {
    let Some(screen) = pick_screen(screens, wanted_screen, Some(rect)) else { return rect };
    let area = screen.work_area;
    let (max_width, max_height) = max.unwrap_or((area.width, area.height));
    let width = rect.width.clamp(min.0.min(area.width), max_width.min(area.width).max(MIN_SIDE));
    let height = rect.height.clamp(min.1.min(area.height), max_height.min(area.height).max(MIN_SIDE));
    let mut fitted = Rect { width, height, ..rect };
    let visible_enough = screens.iter().any(|screen| {
        let (w, h) = fitted.overlap(screen.work_area);
        w >= MIN_SIDE.min(fitted.width) && h >= MIN_SIDE.min(fitted.height)
    });
    if !visible_enough {
        fitted.x = fitted.x.clamp(area.x - fitted.width + MIN_SIDE, area.x + area.width - MIN_SIDE);
        fitted.y = fitted.y.clamp(area.y, area.y + area.height - MIN_SIDE);
    }
    fitted
}

pub(super) fn centered(kind: Kind, screen: &ScreenArea) -> Rect {
    let (width, height) = default_size(kind, screen.scale);
    let area = screen.work_area;
    let (width, height) = (width.min(area.width), height.min(area.height));
    Rect { x: area.x + (area.width - width) / 2, y: area.y + (area.height - height) / 2, width, height }
}

pub(super) fn screen_of(screens: &[ScreenArea], rect: Rect) -> Option<&ScreenArea> {
    pick_screen(screens, None, Some(rect))
}

pub(super) fn system_title(title: &str) -> String {
    format!("{title}{TITLE_SUFFIX}")
}

pub(super) fn alpha(opacity: f64) -> u8 {
    (opacity.clamp(0.0, 1.0) * 255.0).round() as u8
}
