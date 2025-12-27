# Server Setup

## Khởi tạo Virtual Environment

### Windows (Command Prompt):

```bash
python -m venv venv
venv\Scripts\activate
```

### Windows (Git Bash):

```bash
python -m venv venv
source venv/Scripts/activate
```

### Linux/Mac:

```bash
python -m venv venv
source venv/bin/activate
```

## Cài đặt dependencies:

```bash
pip install -r requirement.txt
```

## Chạy server:

```bash
cd src
uvicorn main:app --reload --port 5000
```

hoặc từ root của server:

```bash
uvicorn src.main:app --reload --port 5000
```
