from __future__ import annotations

import argparse

from ultralytics import YOLO


def main() -> None:
    parser = argparse.ArgumentParser(description="Train a custom wildlife detector with YOLO")
    parser.add_argument("--data", required=True, help="Path to dataset yaml file")
    parser.add_argument("--model", default="yolo11n.pt", help="Base model checkpoint")
    parser.add_argument("--epochs", type=int, default=50)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--batch", type=int, default=16)
    parser.add_argument("--project", default="runs/wildlife")
    parser.add_argument("--name", default="train")
    args = parser.parse_args()

    model = YOLO(args.model)
    model.train(
        data=args.data,
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        project=args.project,
        name=args.name,
    )


if __name__ == "__main__":
    main()
