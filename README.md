# aws_fullstack_sample_application


## APIイメージ作成とECRプッシュ
```sh
# 環境変数
export AWS_ACCESS_KEY_ID=xxx
export AWS_SECRET_ACCESS_KEY=xxx
# イメージの作成
docker build . -t sample-api:1.0.0
# タグを追加
docker tag sample-api:1.0.0 xxx.dkr.ecr.us-west-2.amazonaws.com/sample-api:1.0.0
# ECRにプッシュ
docker push xxx.dkr.ecr.us-west-2.amazonaws.com/sample-api:1.0.0
```

## EKSクラスタ整備
### クラスタ作成
```sh
# 作成
aws eks create-cluster \
  --region us-west-2 \
  --name sample-eks-cluster \
  --kubernetes-version 1.20 \
  --role-arn arn:aws:iam::xxx:role/manage-sample-eks-cluster-role \
  --resources-vpc-config subnetIds=subnet-xxx,subnet-xxx,securityGroupIds=sg-xxx \
  --profile sample-admin

# 確認
aws eks describe-cluster \
  --query "cluster.status" \
  --name sample-eks-cluster \
  --region us-west-2 \
  --profile sample-admin
```


### ノードグループ作成
```sh
# 作成
# podのセキュリティグループ変更のため、t3.mediumからm5.largeに変更
aws eks create-nodegroup \
  --cluster-name sample-eks-cluster \
  --nodegroup-name sample-eks-node-group \
  --scaling-config minSize=1,maxSize=2,desiredSize=1 \
  --disk-size 20 \
  --subnets subnet-xxx subnet-xxx \
  --instance-types m5.large \
  --ami-type AL2_x86_64 \
  --remote-access ec2SshKey=sample-eks-node-group-key \
  --node-role arn:aws:iam::xxx:role/node-instance-role \
  --region us-west-2 \
  --profile sample-admin

# 確認
aws eks describe-nodegroup \
  --query "nodegroup.status" \
  --cluster-name sample-eks-cluster \
  --nodegroup-name sample-eks-node-group \
  --region us-west-2 \
  --profile sample-admin

aws eks list-nodegroups \
  --cluster-name sample-eks-cluster \
  --region us-west-2 \
  --profile sample-admin
```

### コンテナデプロイ
```sh
# kubeconfigの更新
aws eks update-kubeconfig \
  --region us-west-2 \
  --name sample-eks-cluster \
  --profile sample-admin


# CNIのバージョンを1.7.7以上にあげる
see https://docs.aws.amazon.com/ja_jp/eks/latest/userguide/cni-upgrades.html

kubectl describe daemonset aws-node --namespace kube-system | grep Image | cut -d "/" -f 2
curl -o aws-k8s-cni.yaml https://raw.githubusercontent.com/aws/amazon-vpc-cni-k8s/release-1.7/config/v1.7/aws-k8s-cni.yaml
kubectl apply -f aws-k8s-cni.yaml

# Podのセキュリティグループを更新するための前準備
kubectl set env daemonset aws-node -n kube-system ENABLE_POD_ENI=true

# クラスタ管理用ロールに以下ポリシーをアタッチ
AmazonEKSVPCResourceController

# 自動作成されたセキュリティグループIDを取得
aws eks describe-cluster \
  --name sample-eks-cluster \
  --query "cluster.resourcesVpcConfig.clusterSecurityGroupId" \
  --output text \
  --region us-west-2 \
  --profile sample-admin

# デプロイ
kubectl apply -f ./api/api-sg-policy.yml
kubectl apply -f ./api/api-deployment.yml
kubectl apply -f ./api/api-service.yml

# 確認
kubectl get pods -o wide
kubectl get service sample-api-service

# cURLで動作確認
curl -X POST http://xxx-xxx.us-west-2.elb.amazonaws.com/comments -H "Content-type: application/json" -d '{ "comment" : "new comment" }'

curl http://xxx-xxx.us-west-2.elb.amazonaws.com/comments/3

# エラー発生時は以下コマンドでログ確認
kubectl describe pods
kubectl describe services
```

### お掃除
```sh
# PODの削除
kubectl delete -f ./api/api-sg-policy.yml
kubectl delete -f ./api/api-deployment.yml
kubectl delete -f ./api/api-service.yml

# ノードグループ削除
aws eks delete-nodegroup \
  --nodegroup-name sample-eks-node-group \
  --cluster-name sample-eks-cluster \
  --region us-west-2 \
  --profile sample-admin

# クラスタ削除
aws eks delete-cluster \
  --name sample-eks-cluster \
  --region us-west-2 \
  --profile sample-admin

# Elastic IPアドレスの解放
https://us-west-2.console.aws.amazon.com/vpc/home?region=us-west-2#Addresses:

```
